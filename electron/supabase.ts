import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Production database (packaged app)
const PROD_SUPABASE_URL = "https://orcpdhrgmhiuzlnrixsn.supabase.co";
const PROD_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yY3BkaHJnbWhpdXpsbnJpeHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODM2MzMsImV4cCI6MjA3NzE1OTYzM30.ai4WMKOrSHUqbpOYvscNNDJ_f-R7zakdH4q1UbdOUW4";



export class SupabaseDatabaseManager {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(PROD_SUPABASE_URL, PROD_SUPABASE_ANON_KEY);
  }

  close(): void {
    // No need to close connection with Supabase
  }

  // Simple helpers
  async getUserByUsername(username: string): Promise<
    | {
        id: number;
        username: string;
        password: string;
        name: string;
        role: string;
      }
    | undefined
  > {
    const { data, error } = await this.supabase
      .from("users")
      .select("id, username, password, name, role")
      .eq("username", username)
      .single();

    if (error || !data) return undefined;
    return data as any;
  }

  async getUserById(id: number): Promise<
    | {
        id: number;
        username: string;
        password: string;
        name: string;
        role: string;
      }
    | undefined
  > {
    const { data, error } = await this.supabase
      .from("users")
      .select("id, username, password, name, role")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;
    return data as any;
  }

  async listOfficials(): Promise<
    Array<{
      id: number;
      name: string;
      email: string;
      phone: string;
      rank: string;
      additional_exams: string;
      active: number;
      notes: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from("officials")
      .select("id, name, email, phone, rank, additional_exams, active, notes")
      .order("name");

    if (error || !data) return [];
    return data as any[];
  }

  async getSetting<T = unknown>(key: string): Promise<T | undefined> {
    const { data, error } = await this.supabase
      .from("settings")
      .select("value")
      .eq("key", key)
      .single();

    if (error) {
      console.error(`Error getting setting '${key}':`, error);
      return undefined;
    }
    if (!data) {
      console.warn(`Setting '${key}' not found in database`);
      return undefined;
    }
    return data.value as T;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.supabase
      .from("settings")
      .upsert({ key, value }, { onConflict: "key" });
  }

  async addOfficial(data: {
    name: string;
    email: string;
    phone: string;
    rank: string;
    additional_exams?: string;
    active?: number;
    notes?: string;
  }): Promise<number> {
    const { data: result, error } = await this.supabase
      .from("officials")
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        rank: data.rank,
        additional_exams: data.additional_exams ?? "",
        active: data.active ?? 1,
        notes: data.notes ?? "",
      })
      .select("id")
      .single();

    if (error || !result) throw new Error("Failed to add official");
    return result.id;
  }

  async updateOfficial(
    id: number,
    data: {
      name: string;
      email: string;
      phone: string;
      rank: string;
      additional_exams?: string;
      active: number;
      notes?: string;
    }
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("officials")
      .update({
        name: data.name,
        email: data.email,
        phone: data.phone,
        rank: data.rank,
        additional_exams: data.additional_exams ?? "",
        active: data.active,
        notes: data.notes ?? "",
      })
      .eq("id", id);

    return !error;
  }

  async deleteOfficial(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("officials")
      .delete()
      .eq("id", id);

    return !error;
  }

  async setOfficialActive(id: number, active: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("officials")
      .update({ active })
      .eq("id", id);

    return !error;
  }

  async listCompetitions(): Promise<
    Array<{
      id: number;
      name: string;
      date: string;
      location: string;
      type: string;
      status: string;
      notes?: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from("competitions")
      .select("id, name, date, location, type, status, notes")
      .order("date", { ascending: false });

    if (error || !data) return [];
    return data as any[];
  }

  async addCompetition(data: {
    name: string;
    date: string;
    location: string;
    type: string;
    status: string;
    notes?: string;
  }): Promise<number> {
    const { data: result, error } = await this.supabase
      .from("competitions")
      .insert({
        name: data.name,
        date: data.date,
        location: data.location,
        type: data.type,
        status: data.status,
        notes: data.notes ?? "",
      })
      .select("id")
      .single();

    if (error || !result) throw new Error("Failed to add competition");
    return result.id;
  }

  async updateCompetition(
    id: number,
    data: {
      name: string;
      date: string;
      location: string;
      type: string;
      status: string;
      notes: string;
    }
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("competitions")
      .update({
        name: data.name,
        date: data.date,
        location: data.location,
        type: data.type,
        status: data.status,
        notes: data.notes,
      })
      .eq("id", id);

    return !error;
  }

  async deleteCompetition(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("competitions")
      .delete()
      .eq("id", id);

    return !error;
  }

  // Payments
  async listPayments(filters?: {
    officialId?: number;
    competitionId?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Array<any>> {
    let query = this.supabase.from("payments").select("*");

    if (filters?.officialId) {
      query = query.eq("official_id", filters.officialId);
    }
    if (filters?.competitionId) {
      query = query.eq("competition_id", filters.competitionId);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.dateFrom) {
      query = query.gte("date", filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte("date", filters.dateTo);
    }

    query = query
      .order("date", { ascending: false })
      .order("id", { ascending: false });

    const { data, error } = await query;

    if (error || !data) return [];

    // Fetch all officials and competitions separately
    const { data: officials } = await this.supabase
      .from("officials")
      .select("id, name");

    const { data: competitions } = await this.supabase
      .from("competitions")
      .select("id, name");

    // Create lookup maps for faster access
    const officialsMap = new Map(officials?.map((o) => [o.id, o.name]) || []);
    const competitionsMap = new Map(
      competitions?.map((c) => [c.id, c.name]) || []
    );

    // Transform data to include names
    return data.map((p: any) => ({
      ...p,
      official_name: officialsMap.get(p.official_id) || null,
      competition_name: competitionsMap.get(p.competition_id) || null,
    }));
  }

  async addPayment(data: {
    official_id: number;
    competition_id: number;
    amount: number;
    date: string;
    method: string;
    status: string;
    date_paid?: string | null;
    notes?: string;
    remarks?: string;
    znesek_sodnik?: number;
    znesek_racun?: number;
  }): Promise<number> {
    const { data: result, error } = await this.supabase
      .from("payments")
      .insert({
        official_id: data.official_id,
        competition_id: data.competition_id,
        amount: data.amount,
        date: data.date,
        method: data.method,
        status: data.status,
        date_paid: data.date_paid || null,
        notes: data.notes ?? "",
        remarks: data.remarks ?? "",
        znesek_sodnik: data.znesek_sodnik ?? 0,
        znesek_racun: data.znesek_racun ?? 0,
      })
      .select("id")
      .single();

    if (error || !result) throw new Error("Failed to add payment");
    return result.id;
  }

  async updatePayment(
    id: number,
    data: {
      official_id: number;
      competition_id: number;
      amount: number;
      date: string;
      method: string;
      status: string;
      date_paid?: string | null;
      notes: string;
      remarks: string;
    }
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("payments")
      .update({
        official_id: data.official_id,
        competition_id: data.competition_id,
        amount: data.amount,
        date: data.date,
        method: data.method,
        status: data.status,
        date_paid: data.date_paid || null,
        notes: data.notes,
        remarks: data.remarks,
      })
      .eq("id", id);

    return !error;
  }

  async deletePayment(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("payments")
      .delete()
      .eq("id", id);

    return !error;
  }

  async markPaymentAsPaid(
    id: number,
    datePaid?: string,
    method?: string,
    isPartial?: boolean,
    partialAmount?: number
  ): Promise<boolean> {
    // First, get the current payment data
    const { data: currentPayment } = await this.supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();

    if (!currentPayment) return false;

    const paymentDate = datePaid || new Date().toISOString().split("T")[0];
    const formattedDate = new Date(paymentDate).toLocaleDateString('sl-SI');
    
    let updateData: any = {};
    
    if (isPartial && partialAmount !== undefined) {
      const remainingAmount = currentPayment.amount - partialAmount;
      
      if (remainingAmount <= 0) {
        // Full payment (partial amount >= total amount)
        updateData = {
          status: "paid",
          date_paid: paymentDate,
          amount: 0,
          remarks: (currentPayment.remarks || '') + 
            (currentPayment.remarks ? '\n' : '') +
            `Plačano v celoti: €${partialAmount.toFixed(2)} (datum: ${formattedDate})`
        };
      } else {
        // Partial payment (remaining amount > 0)
        updateData = {
          status: "owed", // Remains unpaid
          amount: remainingAmount,
          remarks: (currentPayment.remarks || '') + 
            (currentPayment.remarks ? '\n' : '') +
            `Delno plačilo: €${partialAmount.toFixed(2)} (datum: ${formattedDate})`
        };
      }
    } else {
      // Full payment (not partial)
      updateData = {
        status: "paid",
        date_paid: paymentDate,
        amount: 0, // Set remaining amount to 0
        remarks: (currentPayment.remarks || '') + 
          (currentPayment.remarks ? '\n' : '') +
          `Plačano v celoti: €${currentPayment.amount.toFixed(2)} (datum: ${formattedDate})`
      };
    }

    // Only update method if provided
    if (method) {
      updateData.method = method;
    }

    const { error } = await this.supabase
      .from("payments")
      .update(updateData)
      .eq("id", id);

    return !error;
  }

  // Users CRUD
  async listUsers(): Promise<
    Array<{
      id: number;
      username: string;
      name: string;
      role: string;
      created_at: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from("users")
      .select("id, username, name, role, created_at")
      .order("username");

    if (error || !data) return [];
    return data as any[];
  }

  async addUser(data: {
    username: string;
    password: string;
    name: string;
    role: string;
  }): Promise<number> {
    const { data: result, error } = await this.supabase
      .from("users")
      .insert({
        username: data.username,
        password: data.password,
        name: data.name,
        role: data.role,
      })
      .select("id")
      .single();

    if (error || !result) throw new Error("Failed to add user");
    return result.id;
  }

  async updateUser(
    id: number,
    data: { username: string; name: string; role: string; password?: string }
  ): Promise<boolean> {
    const updateData: any = {
      username: data.username,
      name: data.name,
      role: data.role,
    };

    if (data.password) {
      updateData.password = data.password;
    }

    const { error } = await this.supabase
      .from("users")
      .update(updateData)
      .eq("id", id);

    return !error;
  }

  async deleteUser(id: number): Promise<boolean> {
    const { error } = await this.supabase.from("users").delete().eq("id", id);

    return !error;
  }

  // Dashboard stats
  async getDashboardStats(): Promise<any> {
    const { count: officialsCount } = await this.supabase
      .from("officials")
      .select("*", { count: "exact", head: true });

    const { count: activeComps } = await this.supabase
      .from("competitions")
      .select("*", { count: "exact", head: true })
      .in("status", ["planned", "completed"]);

    // Get current year boundaries for paid payments
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const endOfYear = `${currentYear}-12-31`;

    // Get paid payments for current year only (based on date_paid, not competition date)
    // Use znesek_sodnik as the paid amount (original amount for sodnik tariff)
    // Exclude zero payments (free/other_zas competitions)
    const { data: paidPaymentsData } = await this.supabase
      .from("payments")
      .select("znesek_sodnik")
      .eq("status", "paid")
      .gte("date_paid", startOfYear)
      .lte("date_paid", endOfYear)
      .neq("znesek_sodnik", 0);

    // Get owed payments for all time (amount represents remaining debt)
    // Exclude zero payments (free/other_zas competitions)
    const { data: owedPaymentsData } = await this.supabase
      .from("payments")
      .select("amount")
      .eq("status", "owed")
      .neq("znesek_sodnik", 0);

    const paidPayments =
      paidPaymentsData?.reduce((sum, p) => sum + (p.znesek_sodnik || 0), 0) || 0;
    const owedPayments =
      owedPaymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    return {
      totalOfficials: officialsCount || 0,
      activeCompetitions: activeComps || 0,
      totalPayments: paidPayments + owedPayments,
      owedPayments,
      paidPayments,
    };
  }

  // Clear all data from database but keep structure
  async clearAllData(): Promise<boolean> {
    try {
      await this.supabase.from("payments").delete().neq("id", 0);
      await this.supabase.from("competition_officials").delete().neq("id", 0);
      await this.supabase.from("competitions").delete().neq("id", 0);
      await this.supabase.from("officials").delete().neq("id", 0);
      await this.supabase.from("users").delete().neq("username", "admin");
      return true;
    } catch (error) {
      console.error("Error clearing data:", error);
      return false;
    }
  }

  // Role management helpers
  async checkRoleUsage(roleName: string): Promise<
    Array<{
      competition_id: number;
      competition_name: string;
      official_id: number;
      official_name: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from("competition_officials")
      .select("*")
      .eq("role", roleName);

    if (error || !data) return [];

    // Fetch officials and competitions separately
    const { data: officials } = await this.supabase
      .from("officials")
      .select("id, name");

    const { data: competitions } = await this.supabase
      .from("competitions")
      .select("id, name");

    const officialsMap = new Map(officials?.map((o) => [o.id, o.name]) || []);
    const competitionsMap = new Map(
      competitions?.map((c) => [c.id, c.name]) || []
    );

    return data.map((item: any) => ({
      competition_id: item.competition_id,
      competition_name: competitionsMap.get(item.competition_id) || "",
      official_id: item.official_id,
      official_name: officialsMap.get(item.official_id) || "",
    }));
  }

  async deleteRoleReferences(roleName: string): Promise<number> {
    const { count } = await this.supabase
      .from("competition_officials")
      .delete({ count: "exact" })
      .eq("role", roleName);

    return count || 0;
  }

  // Competition Officials Management
  async listCompetitionOfficials(competitionId: number): Promise<
    Array<{
      id: number;
      competition_id: number;
      official_id: number;
      official_name: string;
      role: string;
      hours: number;
      kilometers: number;
      discipline: string;
      notes: string;
      znesek_sodnik: number;
      znesek_racun: number;
    }>
  > {
    const { data, error } = await this.supabase
      .from("competition_officials")
      .select("*")
      .eq("competition_id", competitionId);

    if (error || !data) return [];

    // Fetch officials separately
    const { data: officials } = await this.supabase
      .from("officials")
      .select("id, name");

    const officialsMap = new Map(officials?.map((o) => [o.id, o.name]) || []);

    return data.map((item: any) => ({
      ...item,
      official_name: officialsMap.get(item.official_id) || "",
    }));
  }

  async listAllCompetitionOfficials(): Promise<
    Array<{
      id: number;
      competition_id: number;
      official_id: number;
      official_name: string;
      role: string;
      hours: number;
      kilometers: number;
      discipline: string;
      notes: string;
      znesek_sodnik: number;
      znesek_racun: number;
    }>
  > {
    const { data, error } = await this.supabase
      .from("competition_officials")
      .select("*");

    if (error || !data) return [];

    // Fetch officials separately
    const { data: officials } = await this.supabase
      .from("officials")
      .select("id, name");

    const officialsMap = new Map(officials?.map((o) => [o.id, o.name]) || []);

    return data.map((item: any) => ({
      ...item,
      official_name: officialsMap.get(item.official_id) || "",
    }));
  }

  async addCompetitionOfficial(data: {
    competition_id: number;
    official_id: number;
    role: string;
    hours: number;
    kilometers?: number;
    discipline?: string;
    notes?: string;
    znesek_sodnik?: number;
    znesek_racun?: number;
  }): Promise<number> {
    const { data: result, error } = await this.supabase
      .from("competition_officials")
      .insert({
        competition_id: data.competition_id,
        official_id: data.official_id,
        role: data.role,
        hours: data.hours,
        kilometers: data.kilometers ?? 0,
        discipline: data.discipline ?? "",
        notes: data.notes ?? "",
        znesek_sodnik: data.znesek_sodnik ?? 0,
        znesek_racun: data.znesek_racun ?? 0,
      })
      .select("id")
      .single();

    if (error || !result) {
      console.error('addCompetitionOfficial error:', error);
      console.error('Attempted to insert data:', data);
      throw new Error("Failed to add competition official");
    }
    return result.id;
  }

  async updateCompetitionOfficial(
    id: number,
    data: { role: string; hours: number; kilometers?: number; discipline?: string; notes: string; znesek_sodnik?: number; znesek_racun?: number }
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("competition_officials")
      .update({
        role: data.role,
        hours: data.hours,
        kilometers: data.kilometers ?? 0,
        discipline: data.discipline ?? "",
        notes: data.notes,
        znesek_sodnik: data.znesek_sodnik ?? 0,
        znesek_racun: data.znesek_racun ?? 0,
      })
      .eq("id", id);

    return !error;
  }

  async deleteCompetitionOfficial(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("competition_officials")
      .delete()
      .eq("id", id);

    return !error;
  }

  // Generate payments from competition officials
  async generatePaymentsForCompetition(
    competitionId: number,
    tariffType: 'sodnik' | 'racun' = 'sodnik'
  ): Promise<{ created: number; errors: string[] }> {
    const competition = await this.supabase
      .from("competitions")
      .select("*")
      .eq("id", competitionId)
      .single();

    if (!competition.data) {
      return { created: 0, errors: ["Competition not found"] };
    }

    const officialsResult = await this.listCompetitionOfficials(competitionId);
    const officials = officialsResult;

    const rolesData = await this.getSetting<Array<any>>("official_roles");
    const roles = rolesData ?? [];

    let created = 0;
    const errors: string[] = [];

    for (const official of officials) {
      // Check if we have stored amounts (allow 0 as valid value)
      if (official.znesek_sodnik === null || official.znesek_sodnik === undefined || 
          official.znesek_racun === null || official.znesek_racun === undefined) {
        errors.push(
          `Manjkajoči izračunani zneski za ${official.official_name}. Prosimo ponovno dodelite sodnika.`
        );
        continue;
      }

      // Use stored amount based on tariff type
      const amount = tariffType === 'sodnik' ? official.znesek_sodnik : official.znesek_racun;

      // Check if payment already exists
      const { data: existing } = await this.supabase
        .from("payments")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("official_id", official.official_id)
        .single();

      if (existing) {
        errors.push(`Plačilo že obstaja za ${official.official_name}`);
        continue;
      }

      // Get default payment method from settings
      const defaultPaymentMethod =
        this.getAppSetting("defaultPaymentMethod") || "nakazilo";

      // Create payment with both amounts stored
      try {
        const role = roles.find((r) => r.name === official.role);
        const discipline = official.discipline || "";
        const roleWithDiscipline = discipline ? `${official.role} (${discipline})` : official.role;
        
        const paymentId = await this.addPayment({
          official_id: official.official_id,
          competition_id: competitionId,
          amount: amount, // This is the "preostalo" amount
          date: competition.data.date,
          method: await defaultPaymentMethod,
          status: "owed",
          notes: `${roleWithDiscipline} - ${official.hours}h, ${official.kilometers || 0}km`,
          znesek_sodnik: official.znesek_sodnik,
          znesek_racun: official.znesek_racun,
        });

        if (paymentId > 0) {
          created++;
        }
      } catch (err) {
        errors.push(`Failed to create payment for ${official.official_name}`);
      }
    }

    return { created, errors };
  }

  // App settings helpers
  getAppSetting(key: string): Promise<any> {
    return this.getSetting<Record<string, any>>("app_settings").then(
      (settings) => {
        return settings?.[key];
      }
    );
  }

  async getTravelCostPerKm(): Promise<number> {
    const value = await this.getAppSetting('travelCostPerKm');
    return value !== undefined ? value : 0.37; // Default to 0.37 if not set
  }

  async updateAppSetting(key: string, value: any): Promise<void> {
    const settings =
      (await this.getSetting<Record<string, any>>("app_settings")) || {};
    settings[key] = value;
    await this.setSetting("app_settings", settings);
  }

  // Disciplines management
  async getDisciplines(): Promise<string[]> {
    const disciplines = await this.getAppSetting('disciplines');
    return disciplines || ['Alpsko', 'Nordijsko', 'Tek', 'Skoki', 'Biatlonec', 'Drugo'];
  }

  async setDisciplines(disciplines: string[]): Promise<void> {
    await this.updateAppSetting('disciplines', disciplines);
  }

  async checkDisciplineUsage(discipline: string): Promise<{ count: number; competitions: any[] }> {
    const { data, error } = await this.supabase
      .from('competition_officials')
      .select('id, competition_id, competitions(name)')
      .eq('discipline', discipline);

    if (error) {
      console.error('Error checking discipline usage:', error);
      return { count: 0, competitions: [] };
    }

    return {
      count: data?.length || 0,
      competitions: data || []
    };
  }

  async deleteDisciplineReferences(discipline: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('competition_officials')
      .update({ discipline: null })
      .eq('discipline', discipline);

    return !error;
  }

  async getCompetitionReportData(
    competitionId: number, 
    tariffType: string = 'official'
  ): Promise<
    Array<{
      name: string;
      rank: string;
      role: string;
      discipline: string;
      hours: number;
      amount: number;
      travelCost: number;
      kilometers: number;
    }>
  > {
    // Get competition officials
    const competitionOfficials = await this.listCompetitionOfficials(competitionId);

    if (!competitionOfficials || competitionOfficials.length === 0) {
      return [];
    }

    // Get all officials
    const { data: officials } = await this.supabase
      .from("officials")
      .select("id, name, rank");

    const travelCostPerKm = await this.getTravelCostPerKm();
    const officialsMap = new Map(officials?.map((o) => [o.id, o]) || []);

    // Build report data using stored amounts
    return competitionOfficials.map((co) => {
      const official = officialsMap.get(co.official_id);
      const travelCost = (co.kilometers || 0) * travelCostPerKm;
      
      // Use stored amount based on tariff type
      const baseAmount = tariffType === 'invoice' ? co.znesek_racun : co.znesek_sodnik;

      return {
        name: official?.name || co.official_name || 'Neznano',
        rank: official?.rank || '',
        role: co.role || '',
        discipline: co.discipline || '',
        hours: co.hours || 0,
        amount: baseAmount, // Already includes travel costs from when it was calculated
        travelCost: travelCost,
        kilometers: co.kilometers || 0,
      };
    });
  }

  async getCompetitionsSummaryData(
    competitionIds: number[],
    tariffType: string = 'official'
  ): Promise<
    Array<{
      id: number;
      name: string;
      date: string;
      location: string;
      officialsTotal: number;
      travelTotal: number;
      grandTotal: number;
    }>
  > {
    if (!competitionIds || competitionIds.length === 0) {
      return [];
    }

    // Get competitions info
    const { data: competitions } = await this.supabase
      .from("competitions")
      .select("id, name, date, location")
      .in("id", competitionIds)
      .order("date", { ascending: true });

    if (!competitions || competitions.length === 0) {
      return [];
    }

    const travelCostPerKm = await this.getTravelCostPerKm();

    // Process each competition
    const summaryData = await Promise.all(
      competitions.map(async (comp) => {
        // Get competition officials
        const competitionOfficials = await this.listCompetitionOfficials(comp.id);

        let officialsTotal = 0;
        let travelTotal = 0;

        // Calculate totals for this competition using stored amounts
        for (const co of competitionOfficials) {
          const travelCost = (co.kilometers || 0) * travelCostPerKm;
          
          // Use stored amount based on tariff type
          const baseAmount = tariffType === 'invoice' ? co.znesek_racun : co.znesek_sodnik;

          officialsTotal += baseAmount;
          travelTotal += travelCost;
        }

        return {
          id: comp.id,
          name: comp.name,
          date: comp.date,
          location: comp.location,
          officialsTotal,
          travelTotal,
          grandTotal: officialsTotal + travelTotal,
        };
      })
    );

    return summaryData;
  }
}
