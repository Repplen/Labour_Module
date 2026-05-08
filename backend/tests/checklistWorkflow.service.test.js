const Checklist = require("../models/Checklist");
const {
  applyChecklistDecision,
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

  test("submits a nil approval task without scoring marks", () => {
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
      enableMark: true,
      baseMark: 10,
      delayPenaltyPerDay: 1,
      advanceBonusPerDay: 1,
      finalMark: null,
      dependencyTargetDateTime: null,
      endDateTime: new Date(Date.now() + 60 * 60 * 1000),
      status: "open",
      currentApprovalEmployee: null,
    };

    const result = applyTaskSubmission({
      task,
      body: {
        submissionType: "nil",
        employeeRemarks: "No activity to report.",
        itemResponses: JSON.stringify([
          {
            checklistItemId: "item-1",
            employeeAnswerRemark: "Nil",
          },
        ]),
      },
    });

    expect(result.payload).toBe(task);
    expect(task.approvalType).toBe("nil");
    expect(task.isNilApproval).toBe(true);
    expect(task.status).toBe("nil_for_approval");
    expect(task.enableMark).toBe(false);
    expect(task.baseMark).toBeNull();
    expect(task.finalMark).toBeNull();
    expect(task.currentApprovalEmployee).toBe("employee-2");
  });

  test("resubmits a rejected task on the same task instance and reopens approval", () => {
    const task = {
      checklistItems: [
        toDocument({
          checklistItemId: "item-1",
          label: "Confirm area is safe",
          isRequired: true,
          employeeAnswerRemark: "Old answer",
          answer: "Old answer",
          remarks: "Old answer",
          superiorAnswerRemark: "Incorrect",
          verified: true,
        }),
      ],
      approvalSteps: [
        toDocument({
          approvalLevel: 1,
          approverEmployee: "employee-2",
          status: "rejected",
          remarks: "Incorrect answer",
          actedAt: new Date("2026-05-01T10:00:00.000Z"),
        }),
      ],
      employeeAttachments: [
        {
          fileName: "old-proof.pdf",
          originalName: "old-proof.pdf",
          filePath: "/uploads/old-proof.pdf",
          mimeType: "application/pdf",
          size: 100,
        },
      ],
      approvalHistory: [
        {
          action: "rejected",
          approvalType: "normal",
          status: "rejected",
          actorEmployee: "employee-2",
          remarks: "Incorrect answer",
          actedAt: new Date("2026-05-01T10:00:00.000Z"),
        },
      ],
      assignedEmployee: "employee-1",
      approvalType: "normal",
      isNilApproval: false,
      enableMark: true,
      baseMark: 10,
      delayPenaltyPerDay: 1,
      advanceBonusPerDay: 1,
      finalMark: 8,
      dependencyTargetDateTime: null,
      endDateTime: new Date(Date.now() + 60 * 60 * 1000),
      status: "rejected",
      currentApprovalEmployee: null,
      rejectedBy: "employee-2",
      rejectedAt: new Date("2026-05-01T10:00:00.000Z"),
      rejectionRemarks: "Incorrect answer",
      completedAt: null,
    };

    const result = applyTaskSubmission({
      task,
      body: {
        submissionType: "normal",
        employeeRemarks: "Corrected answer.",
        itemResponses: JSON.stringify([
          {
            checklistItemId: "item-1",
            employeeAnswerRemark: "Corrected and verified",
          },
        ]),
      },
      files: [
        {
          filename: "corrected-proof.pdf",
          originalname: "corrected-proof.pdf",
          mimetype: "application/pdf",
          size: 200,
        },
      ],
    });

    expect(result.payload).toBe(task);
    expect(result.wasResubmission).toBe(true);
    expect(task.status).toBe("submitted");
    expect(task.currentApprovalEmployee).toBe("employee-2");
    expect(task.rejectedBy).toBeNull();
    expect(task.rejectedAt).toBeNull();
    expect(task.rejectionRemarks).toBe("");
    expect(task.resubmittedAt).toBeInstanceOf(Date);
    expect(task.checklistItems[0]).toEqual(
      expect.objectContaining({
        employeeAnswerRemark: "Corrected and verified",
        superiorAnswerRemark: "",
      })
    );
    expect(task.employeeAttachments.map((file) => file.fileName)).toEqual([
      "old-proof.pdf",
      "corrected-proof.pdf",
    ]);
    expect(task.approvalSteps[0]).toEqual(
      expect.objectContaining({
        status: "pending",
        remarks: "",
        actedAt: null,
      })
    );
    expect(task.approvalHistory.map((entry) => entry.action)).toEqual([
      "rejected",
      "resubmitted",
    ]);
  });
});

describe("checklist workflow approval decisions", () => {
  const buildDecisionTask = (overrides = {}) => ({
    checklistItems: [
      toDocument({
        checklistItemId: "item-1",
        label: "Confirm area is safe",
        isRequired: true,
        employeeAnswerRemark: "Checked",
        answer: "Checked",
        remarks: "Checked",
        superiorAnswerRemark: "",
        verified: true,
      }),
    ],
    approvalSteps: [
      toDocument({
        approvalLevel: 1,
        approverEmployee: "employee-2",
        status: "pending",
        remarks: "",
        actedAt: null,
      }),
    ],
    approvalType: "normal",
    isNilApproval: false,
    enableMark: true,
    baseMark: 10,
    delayPenaltyPerDay: 1,
    advanceBonusPerDay: 1,
    finalMark: 10,
    status: "submitted",
    currentApprovalEmployee: "employee-2",
    completedAt: null,
    ...overrides,
  });

  test("blocks nil approval action for a normal submission", () => {
    const task = buildDecisionTask();

    const result = applyChecklistDecision({
      task,
      action: "nil_approve",
      remarks: "",
      itemResponses: [],
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 400,
        message: "Normal approval tasks can only be approved or rejected",
      })
    );
  });

  test("blocks normal approval action for a nil submission", () => {
    const task = buildDecisionTask({
      approvalType: "nil",
      isNilApproval: true,
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
      finalMark: null,
      status: "nil_for_approval",
    });

    const result = applyChecklistDecision({
      task,
      action: "approve",
      remarks: "",
      itemResponses: [],
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 400,
        message: "Nil approval tasks can only be nil approved or rejected",
      })
    );
  });

  test("requires a rejection remark", () => {
    const task = buildDecisionTask();

    const result = applyChecklistDecision({
      task,
      action: "reject",
      remarks: "",
      itemResponses: [],
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 400,
        message: "Rejection remark is required",
      })
    );
  });

  test("rejects without requiring superior item remarks and records rejection history", () => {
    const task = buildDecisionTask();

    const result = applyChecklistDecision({
      task,
      action: "reject",
      remarks: "Answer is incorrect",
      itemResponses: [],
    });

    expect(result.payload).toBe(task);
    expect(task.status).toBe("rejected");
    expect(task.currentApprovalEmployee).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.rejectedBy).toBe("employee-2");
    expect(task.rejectedAt).toBeInstanceOf(Date);
    expect(task.rejectionRemarks).toBe("Answer is incorrect");
    expect(task.approvalSteps[0]).toEqual(
      expect.objectContaining({
        status: "rejected",
        remarks: "Answer is incorrect",
      })
    );
    expect(task.approvalHistory).toEqual([
      expect.objectContaining({
        action: "rejected",
        actorEmployee: "employee-2",
        remarks: "Answer is incorrect",
        status: "rejected",
      }),
    ]);
  });

  test("nil approval completes with no mark", () => {
    const task = buildDecisionTask({
      approvalType: "nil",
      isNilApproval: true,
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
      finalMark: null,
      status: "nil_for_approval",
    });

    const result = applyChecklistDecision({
      task,
      action: "nil_approve",
      remarks: "Nil accepted",
      itemResponses: [
        {
          checklistItemId: "item-1",
          superiorAnswerRemark: "Accepted as nil",
        },
      ],
    });

    expect(result.payload).toBe(task);
    expect(task.status).toBe("nil_approved");
    expect(task.approvalType).toBe("nil");
    expect(task.isNilApproval).toBe(true);
    expect(task.enableMark).toBe(false);
    expect(task.finalMark).toBeNull();
    expect(task.currentApprovalEmployee).toBeNull();
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
