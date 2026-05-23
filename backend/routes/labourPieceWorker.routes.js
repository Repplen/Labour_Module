const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createLabourPieceWorkerController,
  deleteLabourPieceWorkerController,
  getLabourPieceWorkerController,
  listActiveLabourPieceWorkersController,
  listLabourPieceWorkersController,
  updateLabourPieceWorkerController,
  updateLabourPieceWorkerStatusController,
} = require("../controllers/labourPieceWorker.controller");
const {
  validateCreateLabourPieceWorkerRequestMiddleware,
  validateStatusLabourPieceWorkerRequestMiddleware,
  validateUpdateLabourPieceWorkerRequestMiddleware,
} = require("../validators/labourPieceWorker.validator");

router.get("/", auth, requirePermission("labour_piece_worker_master", "view"), listLabourPieceWorkersController);
router.get("/active", auth, requirePermission("labour_piece_worker_master", "view"), listActiveLabourPieceWorkersController);
router.get("/:id", auth, requirePermission("labour_piece_worker_master", "view"), getLabourPieceWorkerController);
router.post("/", auth, requirePermission("labour_piece_worker_master", "add"), validateCreateLabourPieceWorkerRequestMiddleware, createLabourPieceWorkerController);
router.put("/:id", auth, requirePermission("labour_piece_worker_master", "edit"), validateUpdateLabourPieceWorkerRequestMiddleware, updateLabourPieceWorkerController);
router.delete("/:id", auth, requirePermission("labour_piece_worker_master", "delete"), deleteLabourPieceWorkerController);
router.patch("/:id/status", auth, requirePermission("labour_piece_worker_master", "status_update"), validateStatusLabourPieceWorkerRequestMiddleware, updateLabourPieceWorkerStatusController);

module.exports = router;
