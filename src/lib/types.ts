export interface Employee {
  id: string;
  fullName?: string;
  nameWithInitials?: string;
  memberId?: string;
  email?: string;
  contactNo?: string;
  designation?: string;
  division?: string;
  department?: string;
  status?: "Active" | "Pending Approval" | "Inactive";
  gender?: string;
  qualification?: string;
  experience?: string;
  jointDate?: string;
  appointmentDate?: string;
  grossSalary?: string | number;
  epfActive?: "Yes" | "No";
  entitledLeave?: string;
  basicSalary1?: string | number;
  basicSalary2?: string | number;
  fixedAllowance1?: string | number;
  fixedAllowance2?: string | number;
  fixedAllowance3?: string | number;
  epfApplicable?: "Yes" | "No";
  allowAllowance?: "Yes" | "No";
  allowOvertime?: "Yes" | "No";
  profileImage?: string;
  bank1?: {
    name?: string;
    branch?: string;
    branchId?: string;
    accountNo?: string;
    isActive?: boolean;
  };
  bank2?: {
    name?: string;
    branch?: string;
    accountNo?: string;
    isActive?: boolean;
  };
}
