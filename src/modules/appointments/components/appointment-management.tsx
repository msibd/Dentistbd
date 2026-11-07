"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  addClinicDays,
  formatClinicWeekday,
  getClinicDateKey,
} from "@/lib/clinic-date";
import AppointmentReminders from "@/modules/appointments/components/appointment-reminders";
import AppointmentInsights from "@/modules/appointments/components/appointment-insights";
import AppointmentTable from "@/modules/appointments/components/appointment-table";
import type {
  AppointmentRecord,
  AppointmentStatusValue,
} from "@/modules/appointments/schemas/appointment-schema";

const statusNames: Record<AppointmentStatusValue, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const viewModes = ["LIST", "DAY", "WEEK", "MONTH"] as const;
type CalendarMode = (typeof viewModes)[number];

function getCalendarDates(mode: CalendarMode, selectedDate: string) {
  if (mode === "DAY") return [selectedDate];
  if (mode === "WEEK") {
    const weekday = new Date(`${selectedDate}T12:00:00Z`).getUTCDay();
    return Array.from({ length: 7 }, (_, index) =>
      addClinicDays(selectedDate, index - weekday),
    );
  }
  if (mode === "MONTH") {
    const first = `${selectedDate.slice(0, 7)}-01`;
    const offset = new Date(`${first}T12:00:00Z`).getUTCDay();
    return Array.from({ length: 42 }, (_, index) =>
      addClinicDays(first, index - offset),
    );
  }
  return [];
}

function moveDate(date: string, mode: CalendarMode, direction: number) {
  if (mode === "MONTH") {
    const current = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
    current.setUTCMonth(current.getUTCMonth() + direction);
    return `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  return addClinicDays(date, direction * (mode === "WEEK" ? 7 : 1));
}

function getDateLabel(date: string, mode: CalendarMode) {
  const parsedDate = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    ...(mode !== "MONTH" ? { day: "numeric" } : {}),
  }).format(parsedDate);
}

export default function AppointmentManagement({
  appointments,
  defaultStatusFilter,
  onStatusChange,
  onEdit,
  onDelete,
  onNewAppointment,
  onNewWalkIn,
  totalCount,
  sourceCounts,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  appointments: AppointmentRecord[];
  totalCount: number;
  sourceCounts: { direct: number; whatsapp: number };
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  defaultStatusFilter: string;
  onStatusChange: (id: string, status: AppointmentStatusValue) => void;
  onEdit: (appointment: AppointmentRecord) => void;
  onDelete: (appointment: AppointmentRecord) => void;
  onNewAppointment: () => void;
  onNewWalkIn: () => void;
}) {
  const today = getClinicDateKey(new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("LIST");
  const [selectedDate, setSelectedDate] = useState(today);
  const query = search.trim().toLowerCase();
  const services = useMemo(
    () => Array.from(new Set(appointments.map((appointment) => appointment.service))).sort(),
    [appointments],
  );
  const matchesFilters = (appointment: AppointmentRecord, includeStatus: boolean) => {
    const matchesStatus = !includeStatus || statusFilter === "ALL" || appointment.status === statusFilter;
    const matchesService = serviceFilter === "ALL" || appointment.service === serviceFilter;
    const matchesSource = sourceFilter === "ALL" || appointment.source === sourceFilter;
    const appointmentDate = getClinicDateKey(appointment.dateTime);
    const matchesDateRange =
      (!startDate || appointmentDate >= startDate) &&
      (!endDate || appointmentDate <= endDate);
    const matchesSearch =
      !query ||
      [appointment.patientName, appointment.patientPhone, appointment.patientEmail ?? "", appointment.service]
        .some((value) => value.toLowerCase().includes(query));
    return matchesStatus && matchesService && matchesSource && matchesDateRange && matchesSearch;
  };
  const searchedAppointments = appointments.filter((appointment) => matchesFilters(appointment, true));
  // The insight charts ignore the status filter so the status mix still shows every status.
  const insightAppointments = appointments.filter((appointment) => matchesFilters(appointment, false));
  const calendarDates = getCalendarDates(calendarMode, selectedDate);
  const filteredAppointments =
    calendarMode === "LIST"
      ? searchedAppointments
      : searchedAppointments.filter((appointment) =>
          calendarDates.includes(getClinicDateKey(appointment.dateTime)),
        );
  const appointmentsByDate = new Map<string, number>();
  appointments.forEach((appointment) => {
    const date = getClinicDateKey(appointment.dateTime);
    appointmentsByDate.set(date, (appointmentsByDate.get(date) ?? 0) + 1);
  });
  const todayAppointments = appointments.filter(
    (appointment) =>
      getClinicDateKey(appointment.dateTime) === today &&
      appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW",
  );
  const pendingToday = todayAppointments.filter(
    (appointment) => appointment.status === "PENDING",
  ).length;
  const whatsappCount = sourceCounts.whatsapp;
  const directCount = sourceCounts.direct;
  const dashboardCount = appointments.filter((appointment) => appointment.source === "ADMIN").length;
  const walkInCount = appointments.filter((appointment) => appointment.source === "WALK_IN").length;

  return (
    <div className="appointment-management">
      <section className="appointment-summary-bar" aria-label="Appointment summary">
        <div className="appointment-summary-intro">
          <strong>Today&apos;s Appointments: {todayAppointments.length}</strong>
          <span>{pendingToday} Pending</span>
        </div>
        <div className="appointment-summary-metrics">
          <div className="appointment-summary-metric">
            <strong>{todayAppointments.length}</strong>
            <span>Today</span>
          </div>
          <div className="appointment-summary-metric">
            <strong>{totalCount}</strong>
            <span>All bookings</span>
          </div>
          <div className="appointment-summary-metric">
            <strong>{whatsappCount}</strong>
            <span>Via WhatsApp</span>
          </div>
          <div className="appointment-summary-metric">
            <strong>{directCount}</strong>
            <span>Direct website</span>
          </div>
        </div>
        <div className="appointment-new-actions">
          <button type="button" className="button-secondary" onClick={onNewWalkIn}>
            <Plus size={15} /> Walk-in
          </button>
          <button type="button" className="button-primary appointment-new-button" onClick={onNewAppointment}>
            <Plus size={15} /> New appointment
          </button>
        </div>
      </section>

      <AppointmentReminders />

      <AppointmentInsights
        appointments={insightAppointments}
        statusFilter={statusFilter}
        onStatusSelect={setStatusFilter}
        today={today}
      />

      <section className="panel-card appointment-panel">
        <div className="appointment-filter-header">
          <div>
            <h2 className="panel-title">All appointments</h2>
            <div className="panel-description">Search, filter by booking channel, and update appointment status.</div>
          </div>
          <span className="appointment-result-count">{filteredAppointments.length} shown · {totalCount} total</span>
        </div>
        <div className="appointment-filter-bar">
          <label className="appointment-filter-control appointment-service-filter">
            <span>Service type</span>
            <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
              <option value="ALL">All services</option>
              {services.map((service) => <option key={service} value={service}>{service}</option>)}
            </select>
          </label>
          <label className="appointment-filter-control">
            <span>Booking channel</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="ALL">All channels</option>
              <option value="WHATSAPP">WhatsApp ({whatsappCount})</option>
              <option value="DIRECT">Direct website ({directCount})</option>
              <option value="ADMIN">Dashboard ({dashboardCount})</option>
              <option value="WALK_IN">Walk-in ({walkInCount})</option>
            </select>
          </label>
          <label className="appointment-filter-control">
            <span>Date from</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="appointment-filter-control">
            <span>Date to</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          {(startDate || endDate) && (
            <button type="button" className="appointment-clear-filters" onClick={() => {
              setStartDate("");
              setEndDate("");
            }}>
              Clear dates
            </button>
          )}
        </div>
        <div className="appointment-table-toolbar">
          <label className="search-control appointment-search-control">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient, phone or service"
              aria-label="Search appointments"
            />
          </label>
          <select
            className="select-control"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            {Object.entries(statusNames).map(([status, name]) => (
              <option key={status} value={status}>{name}</option>
            ))}
          </select>
        </div>
        <div className="appointment-calendar-toolbar">
          <div className="appointment-view-switch" role="group" aria-label="Appointment calendar view">
            {viewModes.map((mode) => (
              <button
                type="button"
                key={mode}
                className={calendarMode === mode ? "is-selected" : ""}
                aria-pressed={calendarMode === mode}
                onClick={() => setCalendarMode(mode)}
              >
                {mode === "LIST" && <List size={13} />}
                {mode !== "LIST" && <CalendarDays size={13} />}
                {mode === "LIST" ? "List" : mode[0] + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          {calendarMode !== "LIST" && (
            <div className="appointment-calendar-navigation">
              <button type="button" aria-label="Previous date range" onClick={() => setSelectedDate((date) => moveDate(date, calendarMode, -1))}>
                <ChevronLeft size={15} />
              </button>
              <strong>{getDateLabel(selectedDate, calendarMode)}</strong>
              <button type="button" aria-label="Next date range" onClick={() => setSelectedDate((date) => moveDate(date, calendarMode, 1))}>
                <ChevronRight size={15} />
              </button>
              <button type="button" className="appointment-today-button" onClick={() => setSelectedDate(today)}>Today</button>
            </div>
          )}
        </div>
        {calendarMode === "MONTH" && (
          <div className="appointment-month-view">
            <div className="appointment-month-weekdays">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="appointment-month-grid">
              {calendarDates.map((date) => (
                <button
                  type="button"
                  key={date}
                  className={`${date.slice(0, 7) === selectedDate.slice(0, 7) ? "" : "is-outside-month"}${date === selectedDate ? " is-selected" : ""}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span>{Number(date.slice(8))}</span>
                  {appointmentsByDate.get(date) ? <small>{appointmentsByDate.get(date)} visit{appointmentsByDate.get(date) === 1 ? "" : "s"}</small> : null}
                </button>
              ))}
            </div>
          </div>
        )}
        {calendarMode === "WEEK" && (
          <div className="appointment-week-strip">
            {calendarDates.map((date) => (
              <button type="button" key={date} className={date === selectedDate ? "is-selected" : ""} onClick={() => setSelectedDate(date)}>
                <span>{formatClinicWeekday(`${date}T12:00:00Z`)}</span>
                <strong>{date.slice(8)}</strong>
                <small>{appointmentsByDate.get(date) ?? 0} visits</small>
              </button>
            ))}
          </div>
        )}
        {calendarMode === "DAY" && (
          <div className="appointment-day-label"><Clock3 size={14} /> Appointments for {getDateLabel(selectedDate, "DAY")}</div>
        )}
        <AppointmentTable appointments={filteredAppointments} onStatusChange={onStatusChange} onEdit={onEdit} onDelete={onDelete} />
        {hasMore && (
          <div className="appointment-load-more">
            <button type="button" className="button-secondary" disabled={loadingMore} onClick={onLoadMore}>
              {loadingMore ? "Loading appointments…" : `Load older appointments (${appointments.length} of ${totalCount})`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
