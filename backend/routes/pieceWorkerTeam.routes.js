const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createPieceWorkerTeamController,
  deletePieceWorkerTeamController,
  getPieceWorkerTeamController,
  listActivePieceWorkerTeamsController,
  listPieceWorkerTeamsController,
  updatePieceWorkerTeamController,
  updatePieceWorkerTeamStatusController,
} = require("../controllers/pieceWorkerTeam.controller");
const {
  validatePieceWorkerTeamRequestMiddleware,
  validateStatusPieceWorkerTeamRequestMiddleware,
} = require("../validators/pieceWorkerTeam.validator");

router.get("/", auth, requirePermission("piece_worker_team_master", "view"), listPieceWorkerTeamsController);
router.get("/active", auth, requirePermission("piece_worker_team_master", "view"), listActivePieceWorkerTeamsController);
router.get("/:id", auth, requirePermission("piece_worker_team_master", "view"), getPieceWorkerTeamController);
router.post("/", auth, requirePermission("piece_worker_team_master", "add"), validatePieceWorkerTeamRequestMiddleware, createPieceWorkerTeamController);
router.put("/:id", auth, requirePermission("piece_worker_team_master", "edit"), validatePieceWorkerTeamRequestMiddleware, updatePieceWorkerTeamController);
router.delete("/:id", auth, requirePermission("piece_worker_team_master", "delete"), deletePieceWorkerTeamController);
router.patch("/:id/status", auth, requirePermission("piece_worker_team_master", "status_update"), validateStatusPieceWorkerTeamRequestMiddleware, updatePieceWorkerTeamStatusController);

module.exports = router;
