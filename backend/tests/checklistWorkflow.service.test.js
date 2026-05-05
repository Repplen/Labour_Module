const Checklist = require("../models/Checklist");
const {
  applyTaskSubmission,
  buildArchivedChecklistNumber,
  releaseSoftDeletedChecklistNumber,
} = require("../services/checklistWorkflow.service");

const toDocument = (value) => ({
  ...value,
  toObject() {
    return { ...value };
  },
});

describe("checklist workflow submission", () => {
  test("submits a checklist task and opens the first approval step", () => {
    const task = {
      checklistItems: [
        toDocument({
          checklistItemId: "item-1",
          label: "Upload proof",
          isRequired: true,
          employeeAnswerRemark: "",
          answer: "",
          remarks: "",
          superiorAnswerRemark: "",
          verified: false,
        }),
      ],
      approvalSteps: [
        toDocument({
          approverEmployee: "employee-2",
          status: "waiting",
        }),
      ],
      employeeAttachments: [],
      approvalType: "normal",
      isNilApproval: false,
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
      finalMark: null,
      dependencyTargetDateTime: null,
      endDateTime: new Date(Date.now() + 60 * 60 * 1000),
      status: "open",
      currentApprovalEmployee: null,
    };

    const result = applyTaskSubmission({
      task,
      body: {
        submissionType: "normal",
        employeeRemarks: "Completed and attached proof.",
        itemResponses: JSON.stringify([
          {
            checklistItemId: "item-1",
            employeeAnswerRemark: "Proof uploaded",
          },
        ]),
      },
      files: [
        {
          filename: "proof.pdf",
          originalname: "proof.pdf",
          mimetype: "application/pdf",
          size: 1234,
        },
      ],
    });

    expect(result.payload).toBe(task);
    expect(task.status).toBe("submitted");
    expect(task.currentApprovalEmployee).toBe("employee-2");
    expect(task.employeeAttachments).toEqual([
      {
        fileName: "proof.pdf",
        originalName: "proof.pdf",
        filePath: "/uploads/proof.pdf",
        mimeType: "application/pdf",
        size: 1234,
      },
    ]);
    expect(task.checklistItems[0]).toEqual(
      expect.objectContaining({
        employeeAnswerRemark: "Proof uploaded",
        verified: true,
      })
    );
    expect(task.approvalSteps[0]).toEqual(
      expect.objectContaining({
        status: "pending",
      })
    );
  });

  test("blocks submission when a required checklist item is unanswered", () => {
    const task = {
      checklistItems: [
        toDocument({
          checklistItemId: "item-1",
          label: "Upload proof",
          isRequired: true,
          employeeAnswerRemark: "",
          answer: "",
          remarks: "",
          superiorAnswerRemark: "",
          verified: false,
        }),
      ],
      approvalSteps: [
        toDocument({
          approverEmployee: "employee-2",
          status: "waiting",
        }),
      ],
    };

    const result = applyTaskSubmission({
      task,
      body: {
        submissionType: "normal",
        itemResponses: JSON.stringify([]),
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 400,
        message: expect.stringContaining("must be answered"),
      })
    );
  });
});

describe("soft-deleted checklist numbers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("builds an archived number that preserves the original visible number", () => {
    expect(buildArchivedChecklistNumber("AMR - 001", "checklist-id")).toBe(
      "AMR - 001__deleted__checklist-id"
    );
  });

  test("archives a matching soft-deleted checklist number before reuse", async () => {
    const deletedChecklistId = "507f1f77bcf86cd799439011";
    const findOneSpy = jest.spyOn(Checklist.collection, "findOne").mockResolvedValue({
      _id: deletedChecklistId,
      checklistNumber: "AMR - 001",
    });
    const updateOneSpy = jest
      .spyOn(Checklist.collection, "updateOne")
      .mockResolvedValue({ modifiedCount: 1 });

    const result = await releaseSoftDeletedChecklistNumber("AMR - 001");

    expect(result).toBe("AMR - 001__deleted__507f1f77bcf86cd799439011");
    expect(findOneSpy).toHaveBeenCalledWith(
      {
        checklistNumber: "AMR - 001",
        isDeleted: true,
      },
      {
        projection: {
          _id: 1,
          checklistNumber: 1,
        },
      }
    );
    expect(updateOneSpy).toHaveBeenCalledWith(
      {
        _id: deletedChecklistId,
        checklistNumber: "AMR - 001",
        isDeleted: true,
      },
      {
        $set: {
          checklistNumber: "AMR - 001__deleted__507f1f77bcf86cd799439011",
        },
      }
    );
  });
});
