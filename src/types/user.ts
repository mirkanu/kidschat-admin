// Matches LibreChat's MongoDB users collection schema (database: "test")
export interface LibreChatUser {
  _id: string;
  email: string;
  name: string;
  username?: string;
  role: "ADMIN" | "USER";
  password: string; // bcrypt hash
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Shape of the session user after NextAuth authentication
export interface AdminSession {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
}
