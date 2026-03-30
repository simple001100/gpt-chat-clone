export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      anonymous_sessions: {
        Row: {
          id: string;
          fingerprint: string;
          questions_count: number;
          reset_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fingerprint: string;
          questions_count?: number;
          reset_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fingerprint?: string;
          questions_count?: number;
          reset_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chats: {
        Row: {
          id: string;
          user_id: string | null;
          anonymous_id: string | null;
          title: string;
          model_used: string | null;
          total_tokens: number | null;
          is_archived: boolean | null;
          created_at: string;
          updated_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          anonymous_id?: string | null;
          title?: string;
          model_used?: string | null;
          total_tokens?: number | null;
          is_archived?: boolean | null;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          anonymous_id?: string | null;
          title?: string;
          model_used?: string | null;
          total_tokens?: number | null;
          is_archived?: boolean | null;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          role: string;
          content: string;
          tokens_used: number | null;
          model: string | null;
          parent_message_id: string | null;
          response_time_ms: number | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          role: string;
          content: string;
          tokens_used?: number | null;
          model?: string | null;
          parent_message_id?: string | null;
          response_time_ms?: number | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          role?: string;
          content?: string;
          tokens_used?: number | null;
          model?: string | null;
          parent_message_id?: string | null;
          response_time_ms?: number | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          message_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          file_url: string;
          thumbnail_url: string | null;
          ocr_text: string | null;
          width: number | null;
          height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          file_url: string;
          thumbnail_url?: string | null;
          ocr_text?: string | null;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          file_name?: string;
          file_type?: string;
          file_size?: number;
          file_url?: string;
          thumbnail_url?: string | null;
          ocr_text?: string | null;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          user_id: string | null;
          anonymous_id: string | null;
          file_name: string;
          file_type: string;
          file_size: number;
          file_url: string;
          content: string | null;
          chunks: Json | null;
          embedding_model: string | null;
          status: string | null;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          anonymous_id?: string | null;
          file_name: string;
          file_type: string;
          file_size: number;
          file_url: string;
          content?: string | null;
          chunks?: Json | null;
          embedding_model?: string | null;
          status?: string | null;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          anonymous_id?: string | null;
          file_name?: string;
          file_type?: string;
          file_size?: number;
          file_url?: string;
          content?: string | null;
          chunks?: Json | null;
          embedding_model?: string | null;
          status?: string | null;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      chat_documents: {
        Row: {
          chat_id: string;
          document_id: string;
          context_used: boolean | null;
          created_at: string;
        };
        Insert: {
          chat_id: string;
          document_id: string;
          context_used?: boolean | null;
          created_at?: string;
        };
        Update: {
          chat_id?: string;
          document_id?: string;
          context_used?: boolean | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_anonymous_session: {
        Args: { p_fingerprint: string };
        Returns: string;
      };
      increment_anonymous_questions: {
        Args: { p_fingerprint: string };
        Returns: number;
      };
      check_anonymous_limit: {
        Args: { p_fingerprint: string };
        Returns: boolean;
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

