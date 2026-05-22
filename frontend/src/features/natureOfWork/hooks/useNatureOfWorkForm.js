import { useMemo, useState } from "react";
import { buildOutturnPreview, calculateOutturnQuantity } from "../helpers/natureOfWork.helpers";
import { validateNatureOfWorkForm } from "../validators/natureOfWork.validator";

const defaultFormState = {
  workName: "",
  parentWorkId: "",
  parentWork: null,
  isWorkOutturnRequired: false,
  uomId: "",
  customUomName: "",
  length: "",
  breadth: "",
  height: "",
  quantity: "",
  outturnDescription: "",
  isActive: true,
  mode: "create",
  editingWork: null,
  isOpen: false,
};

export function useNatureOfWorkForm(uoms = []) {
  const [formState, setFormState] = useState(defaultFormState);
  const [errors, setErrors] = useState({});

  const selectedUom = useMemo(
    () => uoms.find((uom) => String(uom._id) === String(formState.uomId)) || null,
    [formState.uomId, uoms]
  );

  const preview = useMemo(() => {
    if (!formState.isWorkOutturnRequired || !selectedUom) return { totalQuantity: "", text: "" };
    const totalQuantity = calculateOutturnQuantity({
      formulaType: selectedUom.formulaType,
      length: formState.length,
      breadth: formState.breadth,
      height: formState.height,
      quantity: formState.quantity,
    });
    return {
      totalQuantity,
      text: buildOutturnPreview({
        formulaType: selectedUom.formulaType,
        length: formState.length,
        breadth: formState.breadth,
        height: formState.height,
        quantity: formState.quantity,
        uomSymbol: selectedUom.symbol,
      }),
    };
  }, [formState, selectedUom]);

  const openCreate = () => {
    setFormState({ ...defaultFormState, mode: "create", isOpen: true });
    setErrors({});
  };

  const openChild = (parentWork) => {
    setFormState({
      ...defaultFormState,
      parentWorkId: parentWork?._id || "",
      parentWork,
      mode: "child",
      isOpen: true,
    });
    setErrors({});
  };

  const openEdit = (work) => {
    setFormState({
      workName: work?.workName || "",
      parentWorkId: work?.parentWorkId?._id || work?.parentWorkId || "",
      parentWork: work?.parentWorkId || null,
      isWorkOutturnRequired: Boolean(work?.isWorkOutturnRequired),
      uomId: work?.uomId?._id || work?.uomId || "",
      customUomName: work?.customUomName || "",
      length: work?.length ?? "",
      breadth: work?.breadth ?? "",
      height: work?.height ?? "",
      quantity: work?.quantity ?? "",
      outturnDescription: work?.outturnDescription || "",
      isActive: work?.isActive !== false,
      mode: "edit",
      editingWork: work,
      isOpen: true,
    });
    setErrors({});
  };

  const closeForm = () => {
    setFormState(defaultFormState);
    setErrors({});
  };

  const updateField = (field, value) => {
    setFormState((current) => {
      const next = { ...current, [field]: value };
      if (field === "isWorkOutturnRequired" && !value) {
        Object.assign(next, {
          uomId: "",
          customUomName: "",
          length: "",
          breadth: "",
          height: "",
          quantity: "",
          outturnDescription: "",
        });
      }
      if (field === "uomId") {
        Object.assign(next, {
          customUomName: "",
          length: "",
          breadth: "",
          height: "",
          quantity: "",
          outturnDescription: "",
        });
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const result = validateNatureOfWorkForm(formState);
    setErrors(result.errors);
    return result;
  };

  return {
    closeForm,
    errors,
    formState,
    openChild,
    openCreate,
    openEdit,
    preview,
    selectedUom,
    setErrors,
    updateField,
    validate,
  };
}
