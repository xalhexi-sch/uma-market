export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      businesses: {
        Row: {
          can_buy: boolean
          can_sell: boolean
          created_at: string
          id: string
          legacy_clerk_id: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          can_buy?: boolean
          can_sell?: boolean
          created_at?: string
          id?: string
          legacy_clerk_id?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          can_buy?: boolean
          can_sell?: boolean
          created_at?: string
          id?: string
          legacy_clerk_id?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          business_clerk_id: string
          business_id: string | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          business_clerk_id: string
          business_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          business_clerk_id?: string
          business_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          business_a_id: string
          business_b_id: string
          created_at: string
          id: string
          last_message_at: string
          updated_at: string
        }
        Insert: {
          business_a_id: string
          business_b_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          updated_at?: string
        }
        Update: {
          business_a_id?: string
          business_b_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_a_id_fkey"
            columns: ["business_a_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_business_b_id_fkey"
            columns: ["business_b_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string | null
          created_at: string
          id: string
          order_id: string | null
          product_id: string | null
          sender_business_id: string | null
          sender_clerk_id: string
        }
        Insert: {
          body: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string | null
          sender_business_id?: string | null
          sender_clerk_id: string
        }
        Update: {
          body?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string | null
          sender_business_id?: string | null
          sender_clerk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_clerk_id_fkey"
            columns: ["sender_clerk_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_id"]
          },
          {
            foreignKeyName: "messages_sender_clerk_id_fkey"
            columns: ["sender_clerk_id"]
            isOneToOne: false
            referencedRelation: "public_farmer_profiles"
            referencedColumns: ["clerk_id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string | null
          quantity: number
          subtotal: number | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name?: string | null
          quantity: number
          subtotal?: number | null
          unit?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string | null
          quantity?: number
          subtotal?: number | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          business_clerk_id: string
          business_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          delivery_address: string | null
          farmer_clerk_id: string
          fulfillment_type: string
          id: string
          notes: string | null
          pickup_date: string | null
          placed_by_user_id: string | null
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          business_clerk_id?: string
          business_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_address?: string | null
          farmer_clerk_id: string
          fulfillment_type?: string
          id?: string
          notes?: string | null
          pickup_date?: string | null
          placed_by_user_id?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          business_clerk_id?: string
          business_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_address?: string | null
          farmer_clerk_id?: string
          fulfillment_type?: string
          id?: string
          notes?: string | null
          pickup_date?: string | null
          placed_by_user_id?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_business_clerk_id_fkey"
            columns: ["business_clerk_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_id"]
          },
          {
            foreignKeyName: "orders_business_clerk_id_fkey"
            columns: ["business_clerk_id"]
            isOneToOne: false
            referencedRelation: "public_farmer_profiles"
            referencedColumns: ["clerk_id"]
          },
          {
            foreignKeyName: "orders_farmer_clerk_id_fkey"
            columns: ["farmer_clerk_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_id"]
          },
          {
            foreignKeyName: "orders_farmer_clerk_id_fkey"
            columns: ["farmer_clerk_id"]
            isOneToOne: false
            referencedRelation: "public_farmer_profiles"
            referencedColumns: ["clerk_id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_path: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_until: string | null
          business_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          farmer_clerk_id: string
          harvest_date: string | null
          id: string
          image_path: string | null
          image_url: string | null
          min_order_quantity: number
          moderation_status: string
          name: string
          price_per_unit: number
          quantity_available: number
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          available_until?: string | null
          business_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          farmer_clerk_id: string
          harvest_date?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          min_order_quantity?: number
          moderation_status?: string
          name: string
          price_per_unit: number
          quantity_available?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          available_until?: string | null
          business_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          farmer_clerk_id?: string
          harvest_date?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          min_order_quantity?: number
          moderation_status?: string
          name?: string
          price_per_unit?: number
          quantity_available?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_farmer_clerk_id_fkey"
            columns: ["farmer_clerk_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_id"]
          },
          {
            foreignKeyName: "products_farmer_clerk_id_fkey"
            columns: ["farmer_clerk_id"]
            isOneToOne: false
            referencedRelation: "public_farmer_profiles"
            referencedColumns: ["clerk_id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          balance_after: number
          business_id: string | null
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          product_id: string
          quantity_delta: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          balance_after: number
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          product_id: string
          quantity_delta: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          balance_after?: number
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          product_id?: string
          quantity_delta?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string
          body: string
          created_at: string
          dedupe_key: string
          entity_id: string | null
          entity_type: string
          id: string
          read_at: string | null
          recipient_clerk_id: string
          title: string
          type: string
        }
        Insert: {
          action_url: string
          body: string
          created_at?: string
          dedupe_key: string
          entity_id?: string | null
          entity_type: string
          id?: string
          read_at?: string | null
          recipient_clerk_id: string
          title: string
          type: string
        }
        Update: {
          action_url?: string
          body?: string
          created_at?: string
          dedupe_key?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          read_at?: string | null
          recipient_clerk_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          order_item_id: string
          product_id: string
          rating: number
          reviewer_clerk_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          order_item_id: string
          product_id: string
          rating: number
          reviewer_clerk_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string
          product_id?: string
          rating?: number
          reviewer_clerk_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          business_name: string | null
          city: string
          clerk_id: string
          created_at: string
          full_name: string | null
          id: string
          is_verified: boolean
          phone: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          city?: string
          clerk_id: string
          created_at?: string
          full_name?: string | null
          id?: string
          is_verified?: boolean
          phone?: string | null
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          city?: string
          clerk_id?: string
          created_at?: string
          full_name?: string | null
          id?: string
          is_verified?: boolean
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          reviewer_clerk_id: string
          target_farmer_clerk_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          reviewer_clerk_id: string
          target_farmer_clerk_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          reviewer_clerk_id?: string
          target_farmer_clerk_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_farmer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          business_name: string | null
          city: string | null
          clerk_id: string | null
          full_name: string | null
          is_verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          city?: string | null
          clerk_id?: string | null
          full_name?: string | null
          is_verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          city?: string | null
          clerk_id?: string | null
          full_name?: string | null
          is_verified?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_business_inventory: {
        Args: {
          p_business_id: string
          p_expected_quantity?: number | null
          p_movement_type: string
          p_product_id: string
          p_quantity: number
          p_reason?: string | null
        }
        Returns: Json
      }
      create_business_listing: {
        Args: {
          p_available_until: string | null
          p_business_id: string
          p_category_id: string | null
          p_description: string | null
          p_harvest_date: string | null
          p_image_paths?: string[]
          p_min_order_quantity: number
          p_name: string
          p_opening_quantity: number
          p_price_per_unit: number
          p_status: string
          p_unit: string
        }
        Returns: string
      }
      current_seller_business_ids: { Args: never; Returns: string[] }
      set_business_listing_status: {
        Args: { p_business_id: string; p_product_id: string; p_status: string }
        Returns: string
      }
      update_business_listing: {
        Args: {
          p_available_until: string | null
          p_business_id: string
          p_category_id: string | null
          p_description: string | null
          p_harvest_date: string | null
          p_image_paths?: string[] | null
          p_min_order_quantity: number
          p_name: string
          p_price_per_unit: number
          p_product_id: string
          p_status?: string | null
          p_unit: string
        }
        Returns: undefined
      }
      get_business_overview_metrics: {
        Args: { p_end: string; p_prev_start: string; p_start: string }
        Returns: Json
      }
      get_farmer_overview_metrics: {
        Args: { p_end: string; p_prev_start: string; p_start: string }
        Returns: Json
      }
      get_product_review_summary: {
        Args: { p_product_id: string }
        Returns: Json
      }
      get_seller_review_summary: {
        Args: { p_farmer_clerk_id: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_action_url: string
          p_body: string
          p_dedupe_key: string
          p_entity_id: string
          p_entity_type: string
          p_recipient: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      place_checkout_orders: { Args: { p_orders?: Json }; Returns: Json }
      place_order: {
        Args: {
          p_delivery_address?: string
          p_farmer_clerk_id: string
          p_fulfillment_type: string
          p_items?: Json
          p_notes?: string
          p_pickup_date?: string
        }
        Returns: Json
      }
      search_products: {
        Args: {
          p_category_slug?: string
          p_in_stock_only?: boolean
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
        }
        Returns: {
          available_until: string
          category: Json
          category_id: string
          created_at: string
          description: string
          farmer: Json
          farmer_clerk_id: string
          harvest_date: string
          id: string
          image_path: string
          image_url: string
          images: Json
          min_order_quantity: number
          name: string
          price_per_unit: number
          quantity_available: number
          search_rank: number
          status: string
          total_count: number
          unit: string
          updated_at: string
        }[]
      }
      update_order_status: {
        Args: {
          p_cancellation_reason?: string
          p_new_status: string
          p_order_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
