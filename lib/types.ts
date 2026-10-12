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
}
