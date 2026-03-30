export type ChatItem = {
  id: string;
  title: string;
  updated_at: string;
};

export type MessageAttachment = {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  attachments?: MessageAttachment[];
};

export type UploadedFile = {
  bucket: string;
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
};

export type ContextDocument = {
  id: string;
  fileName: string;
  fileType: string;
  content: string;
  tokenEstimate: number;
  truncated: boolean;
};

export type SessionInfo = {
  accessToken: string;
  email: string;
};

export type ChatModelOption = {
  value: string;
  label: string;
};
