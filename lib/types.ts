export interface Section {
  id: number;
  heading: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  sections: Section[];
  tasks?: string;
  userId?: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  purchaseDate: string; // YYYY-MM-DD
  renewalDate: string;  // YYYY-MM-DD
  createdAt?: number;
  userId?: string;
}

export interface PasswordItem {
  id: string;
  projectName: string;
  url: string;
  identifier: string; // ID / Username / Email
  password: string;   // Saved in plain text
  createdAt: string;
  userId?: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  recoveryKey?: string;
  createdAt: string;
}

export interface SharedLink {
  id: string;
  projectId: string;
  projectName: string;
  content: string;
  expiresAt: string;
  createdAt: string;
}

