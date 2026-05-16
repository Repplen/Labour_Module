import DepartmentForm from "../../components/masters/departments/DepartmentForm";
import DepartmentHeader from "../../components/masters/departments/DepartmentHeader";
import DepartmentTable from "../../components/masters/departments/DepartmentTable";
import SubDepartmentManager from "../../components/masters/departments/SubDepartmentManager";
import { useDepartmentMaster } from "../../hooks/departments/useDepartmentMaster";

export default function DepartmentMaster() {
  const {
    departmentForm,
    departmentsTable,
    summary,
    subDepartmentManager,
  } = useDepartmentMaster();

  return (
    <div className="container mt-4 mb-5">
      <DepartmentHeader
        departmentCount={summary.departmentCount}
        selectedHeadCount={summary.selectedHeadCount}
      />
      <DepartmentForm {...departmentForm} />
      <DepartmentTable {...departmentsTable} />
      <SubDepartmentManager {...subDepartmentManager} />
    </div>
  );
}
