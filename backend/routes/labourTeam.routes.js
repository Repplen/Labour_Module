const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createLabourTeamController,
  deleteLabourTeamController,
  getLabourTeamController,
  listActiveLabourTeamsController,
  listLabourTeamsController,
  updateLabourTeamController,
  updateLabourTeamStatusController,
} = require("../controllers/labourTeam.controller");
const {
  validateLabourTeamRequestMiddleware,
  validateStatusLabourTeamRequestMiddleware,
} = require("../validators/labourTeam.validator");

router.get("/", auth, requirePermission("labour_team_master", "view"), listLabourTeamsController);
router.get("/active", auth, requirePermission("labour_team_master", "view"), listActiveLabourTeamsController);
router.get("/:id", auth, requirePermission("labour_team_master", "view"), getLabourTeamController);
router.post("/", auth, requirePermission("labour_team_master", "add"), validateLabourTeamRequestMiddleware, createLabourTeamController);
router.put("/:id", auth, requirePermission("labour_team_master", "edit"), validateLabourTeamRequestMiddleware, updateLabourTeamController);
router.delete("/:id", auth, requirePermission("labour_team_master", "delete"), deleteLabourTeamController);
router.patch("/:id/status", auth, requirePermission("labour_team_master", "status_update"), validateStatusLabourTeamRequestMiddleware, updateLabourTeamStatusController);

module.exports = router;
