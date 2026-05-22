const locationNameRegex = /^(?=.*[A-Za-z])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

export const normalizeLocationName = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");

export const validateMainLocationForm = ({ siteId, locationName, parentLocationId }) => {
  const errors = {};
  const normalizedName = normalizeLocationName(locationName);

  if (!parentLocationId && !siteId) {
    errors.siteId = "Site name is required.";
  }

  if (!normalizedName) {
    errors.locationName = "Location name is required.";
  } else if (!locationNameRegex.test(normalizedName)) {
    errors.locationName = "Location name must contain valid text.";
  }

  return {
    errors,
    values: {
      siteId,
      locationName: normalizedName,
      parentLocationId: parentLocationId || "",
    },
  };
};
