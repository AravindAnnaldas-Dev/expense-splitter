export interface Member {
  id: string; // GroupMember id
  user: { id: string; name: string; email: string };
}

export interface ExpenseShare {
  id: string;
  memberId: string;
  amount: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidById: string;
  paidBy: { id: string; user: { id: string; name: string } };
  shares: ExpenseShare[];
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  createdAt: string;
  members: Member[];
  expenses?: Expense[];
}

export interface MemberBalance {
  memberId: string;
  userId: string;
  name: string;
  net: number;
}

export interface SettlementSuggestion {
  from: { memberId: string; userId: string; name: string };
  to: { memberId: string; userId: string; name: string };
  amount: number;
}
