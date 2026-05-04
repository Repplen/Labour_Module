import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import SearchableCheckboxSelector from "../../components/SearchableCheckboxSelector";

const buildEmptyQuestion = () => ({
  questionText: "",
  responseType: "single_choice",
  options: [{ text: "" }, { text: "" }],
});

const INDIA_TIME_ZONE = "Asia/Kolkata";
const TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const getIndiaDateTimeParts = (value) => {
  if (!value) return { date: "", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(parsed)
    .reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

const normalizeDateInput = (value) => {
  if (!value) return "";
  return getIndiaDateTimeParts(value).date;
};

const normalizeTimeInput = (value) => {
  if (!value) return "";
  const normalized = String(value || "").trim();
  if (TIME_INPUT_PATTERN.test(normalized)) return normalized;
  return getIndiaDateTimeParts(value).time;
};

const buildDateTimeKey = (dateValue, timeValue) =>
  dateValue && timeValue ? `${dateValue}T${timeValue}` : "";

const getManualStatus = (poll = {}) =>
  poll.isEnabled === false || String(poll.status || "").toLowerCase() === "inactive"
    ? "inactive"
    : "active";

export default function PollCreate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [scopeOptions, setScopeOptions] = useState({
    companies: [],
    sites: [],
    departments: [],
  });
  const [form, setForm] = useState({
    title: "",
    description: "",
    scopeType: "company",
    scopeIds: [],
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    status: "active",
    allowResubmission: false,
    questions: [buildEmptyQuestion()],
  });

  useEffect(() => {
    const loadScreen = async () => {
      try {
        const optionsResponse = await api.get("/polls/options");
        setScopeOptions({
          companies: Array.isArray(optionsResponse.data?.companies)
            ? optionsResponse.data.companies
            : [],
          sites: Array.isArray(optionsResponse.data?.sites) ? optionsResponse.data.sites : [],
          departments: Array.isArray(optionsResponse.data?.departments)
            ? optionsResponse.data.departments
            : [],
        });

        if (isEditMode) {
          const pollResponse = await api.get(`/polls/${id}`);
          const poll = pollResponse.data || {};
          const startDateSource = poll.startDateTime || poll.startDate;
          const endDateSource = poll.endDateTime || poll.endDate;

          setForm({
            title: poll.title || "",
            description: poll.description || "",
            scopeType: poll.scopeType || "company",
            scopeIds: Array.isArray(poll.scopeIds) ? poll.scopeIds : [],
            startDate: normalizeDateInput(startDateSource),
            startTime: poll.startTime || (poll.startDateTime ? normalizeTimeInput(startDateSource) : "00:00"),
            endDate: normalizeDateInput(endDateSource),
            endTime: poll.endTime || (poll.endDateTime ? normalizeTimeInput(endDateSource) : "23:59"),
            status: getManualStatus(poll),
            allowResubmission: Boolean(poll.allowResubmission),
            questions:
              Array.isArray(poll.questions) && poll.questions.length
                ? poll.questions.map((question) => ({
                    _id: question._id,
                    questionText: question.questionText || "",
                    responseType: question.responseType || "single_choice",
                    options:
                      Array.isArray(question.options) && question.options.length
                        ? question.options.map((option) => ({
                            _id: option._id,
                            text: option.text || "",
                          }))
                        : [{ text: "" }, { text: "" }],
                  }))
                : [buildEmptyQuestion()],
          });
        }
      } catch (err) {
        alert(err.response?.data?.message || "Failed to load poll setup");
        navigate("/polls");
      } finally {
        setLoading(false);
      }
    };

    void loadScreen();
  }, [id, isEditMode, navigate]);

  const activeScopeOptions = useMemo(() => {
    if (form.scopeType === "site") return scopeOptions.sites;
    if (form.scopeType === "department") return scopeOptions.departments;
    return scopeOptions.companies;
  }, [form.scopeType, scopeOptions]);

  const updateQuestion = (questionIndex, nextValue) => {
    setForm((currentForm) => ({
      ...currentForm,
      questions: currentForm.questions.map((question, index) =>
        index === questionIndex ? { ...question, ...nextValue } : question
      ),
    }));
  };

  const updateQuestionOption = (questionIndex, optionIndex, text) => {
    setForm((currentForm) => ({
      ...currentForm,
      questions: currentForm.questions.map((question, index) => {
        if (index !== questionIndex) return question;
        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex ? { ...option, text } : option
          ),
        };
      }),
    }));
  };

  const addQuestion = () => {
    setForm((currentForm) => ({
      ...currentForm,
      questions: [...currentForm.questions, buildEmptyQuestion()],
    }));
  };

  const removeQuestion = (questionIndex) => {
    if (form.questions.length === 1) {
      alert("At least one question is required");
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      questions: currentForm.questions.filter((_, index) => index !== questionIndex),
    }));
  };

  const addQuestionOption = (questionIndex) => {
    setForm((currentForm) => ({
      ...currentForm,
      questions: currentForm.questions.map((question, index) =>
        index === questionIndex
          ? { ...question, options: [...question.options, { text: "" }] }
          : question
      ),
    }));
  };

  const removeQuestionOption = (questionIndex, optionIndex) => {
    const question = form.questions[questionIndex];
    if (!question || question.options.length <= 2) {
      alert("Each question needs at least two options");
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      questions: currentForm.questions.map((questionRow, index) =>
        index === questionIndex
          ? {
              ...questionRow,
              options: questionRow.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex),
            }
          : questionRow
      ),
    }));
  };

  const handleScopeTypeChange = (scopeType) => {
    setForm((currentForm) => ({
      ...currentForm,
      scopeType,
      scopeIds: [],
    }));
    setPreviewRows([]);
    setPreviewCount(0);
  };

  const previewAssignees = async () => {
    if (!form.scopeIds.length) {
      alert("Select at least one scope item");
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await api.post("/polls/assignee-preview", {
        scopeType: form.scopeType,
        scopeIds: form.scopeIds,
      });

      setPreviewCount(Number(response.data?.count || 0));
      setPreviewRows(Array.isArray(response.data?.employees) ? response.data.employees : []);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to preview assignees");
      setPreviewCount(0);
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const savePoll = async () => {
    setValidationMessage("");

    if (!form.title.trim()) {
      setValidationMessage("Enter poll title");
      return;
    }

    if (!form.scopeIds.length) {
      setValidationMessage("Select at least one scope item");
      return;
    }

    if (!form.startDate || !form.startTime) {
      setValidationMessage("Start date and start time are required");
      return;
    }

    if (!form.endDate || !form.endTime) {
      setValidationMessage("End date and end time are required");
      return;
    }

    if (buildDateTimeKey(form.endDate, form.endTime) <= buildDateTimeKey(form.startDate, form.startTime)) {
      setValidationMessage("End date time must be greater than start date time");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      scopeType: form.scopeType,
      scopeIds: form.scopeIds,
      startDate: form.startDate,
      startTime: form.startTime,
      endDate: form.endDate,
      endTime: form.endTime,
      status: form.status,
      isEnabled: form.status !== "inactive",
      allowResubmission: form.allowResubmission,
      questions: form.questions,
    };

    setSaving(true);
    try {
      if (isEditMode) {
        await api.put(`/polls/${id}`, payload);
      } else {
        await api.post("/polls", payload);
      }

      navigate("/polls");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save poll");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container mt-4">Loading poll setup...</div>;
  }

  return (
    <div className="container-fluid mt-4 mb-5" data-testid="poll-create-page">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Polling</div>
            <h3 className="mb-1">{isEditMode ? "Edit Poll" : "Create Poll"}</h3>
            <p className="page-subtitle mb-0">
              Configure scope, dates, response rules, and questions in one flow.
            </p>
          </div>

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/polls")}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={savePoll}
              disabled={saving}
              data-testid="save-poll-button"
            >
              {saving ? "Saving..." : isEditMode ? "Update Poll" : "Create Poll"}
            </button>
          </div>
        </div>
      </div>

      <div className="soft-card mb-4">
        <div className="row g-3">
          {validationMessage ? (
            <div className="col-12">
              <div className="alert alert-danger py-2 mb-0">{validationMessage}</div>
            </div>
          ) : null}

          <div className="col-lg-4">
            <label className="form-label fw-semibold">Poll Title</label>
            <input
              className="form-control"
              value={form.title}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, title: event.target.value }))
              }
              placeholder="Enter poll title"
            />
          </div>

          <div className="col-lg-2">
            <label className="form-label fw-semibold">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={form.startDate}
              data-testid="poll-start-date"
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, startDate: event.target.value }))
              }
            />
          </div>

          <div className="col-lg-2">
            <label className="form-label fw-semibold">Start Time</label>
            <input
              type="time"
              className="form-control"
              value={form.startTime}
              data-testid="poll-start-time"
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, startTime: event.target.value }))
              }
            />
          </div>

          <div className="col-lg-2">
            <label className="form-label fw-semibold">End Date</label>
            <input
              type="date"
              className="form-control"
              value={form.endDate}
              data-testid="poll-end-date"
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, endDate: event.target.value }))
              }
            />
          </div>

          <div className="col-lg-2">
            <label className="form-label fw-semibold">End Time</label>
            <input
              type="time"
              className="form-control"
              value={form.endTime}
              data-testid="poll-end-time"
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, endTime: event.target.value }))
              }
            />
          </div>

          <div className="col-12">
            <label className="form-label fw-semibold">Description / Purpose</label>
            <textarea
              className="form-control"
              rows="3"
              value={form.description}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, description: event.target.value }))
              }
              placeholder="Explain the purpose of this poll"
            />
          </div>

          <div className="col-lg-4">
            <label className="form-label fw-semibold">Scope Type</label>
            <select
              className="form-select"
              value={form.scopeType}
              onChange={(event) => handleScopeTypeChange(event.target.value)}
            >
              <option value="company">Company</option>
              <option value="site">Site</option>
              <option value="department">Department</option>
            </select>
          </div>

          <div className="col-lg-4">
            <label className="form-label fw-semibold">Status</label>
            <select
              className="form-select"
              value={form.status}
              onChange={(event) =>
                setForm((currentForm) => ({ ...currentForm, status: event.target.value }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="col-lg-4 d-flex align-items-end">
            <div className="form-check form-switch mb-2">
              <input
                id="allowResubmission"
                className="form-check-input"
                type="checkbox"
                checked={form.allowResubmission}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    allowResubmission: event.target.checked,
                  }))
                }
              />
              <label className="form-check-label fw-semibold" htmlFor="allowResubmission">
                Allow Resubmission
              </label>
            </div>
          </div>

          <div className="col-12">
            <SearchableCheckboxSelector
              label={`Select ${form.scopeType}`}
              helperText={`Choose one or more ${form.scopeType} targets for this poll.`}
              options={activeScopeOptions}
              selectedValues={form.scopeIds}
              onChange={(nextValues) => {
                setForm((currentForm) => ({ ...currentForm, scopeIds: nextValues }));
                setPreviewRows([]);
                setPreviewCount(0);
              }}
              searchPlaceholder={`Search ${form.scopeType}`}
              emptyMessage={`No ${form.scopeType} records are available in your scope.`}
            />
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
          <button type="button" className="btn btn-outline-primary" onClick={previewAssignees} disabled={previewLoading}>
            {previewLoading ? "Loading preview..." : "Preview Assignees"}
          </button>
          <div className="small text-muted">
            {previewCount
              ? `${previewCount} employee${previewCount === 1 ? "" : "s"} will receive this poll.`
              : "Preview the employee list before saving."}
          </div>
        </div>

        {previewRows.length ? (
          <div className="table-responsive mt-3">
            <table className="table table-sm table-bordered align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Company</th>
                  <th>Site</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={row._id}>
                    <td>{index + 1}</td>
                    <td>{row.label}</td>
                    <td>{row.companies?.join(", ") || "-"}</td>
                    <td>{row.sites?.join(", ") || "-"}</td>
                    <td>{row.departments?.join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1">Questions & Options</h4>
          <div className="small text-muted">
            Add one or more questions. Each question needs at least two options.
          </div>
        </div>

        <button type="button" className="btn btn-outline-success" onClick={addQuestion}>
          Add Question
        </button>
      </div>

      <div className="d-flex flex-column gap-3">
        {form.questions.map((question, questionIndex) => (
          <div className="soft-card" key={question._id || `question-${questionIndex}`}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div className="fw-semibold">Question {questionIndex + 1}</div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => removeQuestion(questionIndex)}
              >
                Remove Question
              </button>
            </div>

            <div className="row g-3">
              <div className="col-lg-8">
                <label className="form-label fw-semibold">Question Text</label>
                <input
                  className="form-control"
                  value={question.questionText}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { questionText: event.target.value })
                  }
                  placeholder="Enter question"
                />
              </div>

              <div className="col-lg-4">
                <label className="form-label fw-semibold">Response Type</label>
                <select
                  className="form-select"
                  value={question.responseType}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { responseType: event.target.value })
                  }
                >
                  <option value="single_choice">Single Choice</option>
                  <option value="multiple_choice">Multiple Choice</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                <div className="fw-semibold">Options</div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => addQuestionOption(questionIndex)}
                >
                  Add Option
                </button>
              </div>

              <div className="row g-3">
                {question.options.map((option, optionIndex) => (
                  <div
                    className="col-lg-6"
                    key={option._id || `question-${questionIndex}-option-${optionIndex}`}
                  >
                    <div className="input-group">
                      <span className="input-group-text">Option {optionIndex + 1}</span>
                      <input
                        className="form-control"
                        value={option.text}
                        onChange={(event) =>
                          updateQuestionOption(questionIndex, optionIndex, event.target.value)
                        }
                        placeholder="Enter answer option"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => removeQuestionOption(questionIndex, optionIndex)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
