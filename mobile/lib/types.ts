export type Role = 'admin' | 'sub-admin' | 'user';

export type User = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  therapyType?: string | null;
  createdAt?: string;
};

export type Doctor = {
  id: number;
  name: string;
  therapyType: string;
};

export type Patient = {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  notes: string | null;
  therapyType?: string | null;
  doctorId?: number | null;
  doctorName?: string | null;
  createdAt?: string;
  patientType?: 'Private' | 'Company' | 'Islamic' | null;
  sessionsAllotted?: number | null;
  sessionCount?: number;
  nextVisit?: string | null;
  reasons?: string[];
};

export type VisitStatus = 'scheduled' | 'completed' | 'cancelled';

export type Reservation = {
  id: number;
  patientId: number;
  patientName: string;
  phone: string | null;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  doctorId?: number | null;
  doctorName?: string | null;
  status: VisitStatus;
  notes: string | null;
  amountPaid?: number | null;
  patientType?: 'Private' | 'Company' | 'Islamic' | null;
  therapyType?: string | null;
  createdByName: string | null;
};

export type IncomeDay = {
  date: string;
  total: number;
  paid: { patientName: string; amount: number; startTime: string; therapyType?: string | null }[];
};

export type IncomeCategory = {
  type: 'Private' | 'Company' | 'Islamic';
  total: number;
  days: IncomeDay[];
};

export type OutcomeCategoryKey = 'salaries' | 'rent' | 'services' | 'equipment';

export type OutcomeItem = {
  id: number;
  label: string;
  amount: number;
  staffId?: number | null;
  therapyType?: string | null;
};

export type OutcomeCategory = {
  key: OutcomeCategoryKey;
  label: string;
  total: number;
  items: OutcomeItem[];
};

export type OutcomeMonth = {
  month: string;
  total: number;
  categories: OutcomeCategory[];
};

export type IncomeMonth = {
  month: string;
  from: string;
  to: string;
  total: number;
  categories: IncomeCategory[];
};

export type DashboardNamedCount = {
  id: number;
  name?: string;
  fullName?: string;
  therapyType?: string | null;
  sessions: number;
};

export type DashboardTherapy = {
  name: string;
  sessions: number;
  completed: number;
  income: number;
  outcome: number;
};

export type DashboardReport = {
  totalSessions: number;
  totalIncome: number;
  totalOutcome: number;
  completed: number;
  scheduled: number;
  cancelled: number;
  therapies: DashboardTherapy[];
  therapists: DashboardNamedCount[];
  patients: DashboardNamedCount[];
};

export type DocumentRow = {
  id: number;
  name: string;
  description: string | null;
  patientId: number | null;
  patientName: string | null;
  staffId?: number | null;
  staffName?: string | null;
  therapyType?: string | null;
  fileName: string | null;
  mimeType: string | null;
  uploadedById?: number | null;
  uploadedByName: string | null;
  createdDate?: string | null;
  createdAt: string;
};

export type Instrument = {
  id: number;
  therapyType: string;
  name: string;
  usedFor: string;
  price: number;
  pricedAt?: string;
  fileName: string | null;
  mimeType: string | null;
  hasImage: boolean;
  addedByName: string | null;
  createdAt: string;
};

export type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
  file?: Blob;
};
