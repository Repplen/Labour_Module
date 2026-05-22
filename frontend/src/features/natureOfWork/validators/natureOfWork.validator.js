import { normalizeWorkName } from "../helpers/natureOfWork.helpers";

const workNameRegex = /^(?=.*[A-Za-z])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

export const validateNatureOfWorkForm = (formState) => {
  const errors = {};
  const values = {
    workName: normalizeWorkName(formState.workName),
    parentWorkId: formState.parentWorkId || "",
    isWorkOutturnRequired: Boolean(formState.isWorkOutturnRequired),
    uomId: formState.uomId || "",
    customUomName: normalizeWorkName(formState.customUomName),
    length: formState.length,
    breadth: formState.breadth,
    height: formState.height,
    quantity: formState.quantity,
    outturnDescription: formState.outturnDescription || "",
    isActive: formState.isActive !== false,
  };

  if (!values.workName) errors.workName = "Work name is required.";
  else if (!workNameRegex.test(values.workName)) errors.workName = "Work name must contain valid text.";

  if (values.isWorkOutturnRequired) {
    if (!values.uomId) errors.uomId = "UOM is required.";
  }

  return { errors, values };
};
