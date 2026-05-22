const {
  VALID_LOCATION_NAME_REGEX,
  buildTree,
  normalizeLocationName,
} = require("../helpers/mainLocation.helper");

describe("main location helper", () => {
  test("normalizes location names", () => {
    expect(normalizeLocationName("  Building   A  ")).toBe("Building A");
  });

  test("rejects location names without valid text", () => {
    expect(VALID_LOCATION_NAME_REGEX.test("---")).toBe(false);
    expect(VALID_LOCATION_NAME_REGEX.test("###")).toBe(false);
  });

  test("accepts business location names", () => {
    expect(VALID_LOCATION_NAME_REGEX.test("Building A")).toBe(true);
    expect(VALID_LOCATION_NAME_REGEX.test("Room 101")).toBe(true);
    expect(VALID_LOCATION_NAME_REGEX.test("Rack 1")).toBe(true);
  });

  test("builds nested tree from self-referencing rows", () => {
    const rows = [
      {
        _id: "floor-1",
        locationName: "Floor 1",
        parentLocationId: "building-a",
      },
      {
        _id: "building-a",
        locationName: "Building A",
        parentLocationId: null,
      },
      {
        _id: "room-101",
        locationName: "Room 101",
        parentLocationId: "floor-1",
      },
    ];

    const tree = buildTree(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].locationName).toBe("Building A");
    expect(tree[0].children[0].locationName).toBe("Floor 1");
    expect(tree[0].children[0].children[0].locationName).toBe("Room 101");
  });
});
