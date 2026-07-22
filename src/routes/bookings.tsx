import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";

interface Booking {
  fullName: string;
  email: string;
  businessName: string;
  industry: string;
  preferredDay: string;
  preferredTime: string;
  notes: string;
  timestamp: string;
}

const getBookings = createServerFn({ method: "GET" }).handler(async (): Promise<Booking[]> => {
  const { default: fs } = await import("node:fs");
  const { default: path } = await import("node:path");
  const BOOKINGS_FILE = path.join(process.cwd(), "..", "bookings.json");

  try {
    const raw = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    return JSON.parse(raw) as Booking[];
  } catch {
    return [];
  }
});

export const Route = createFileRoute("/bookings")({
  loader: () => getBookings(),
  component: BookingsPage,
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BookingsPage() {
  const bookings = Route.useLoaderData() as Booking[];

  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline="Strategy Call Bookings"
          description="All strategy call requests submitted through the MetroReach Media website."
        />

        <div className="mb-8">
          <p className="text-lg font-semibold text-text-primary">
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""} received
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-12 text-center">
            <p className="text-text-secondary text-lg">
              No bookings yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Date / Time
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Name
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Business
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Email
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Preferred Day/Time
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-text-muted uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings
                  .slice()
                  .reverse()
                  .map((booking, i) => (
                    <tr
                      key={i}
                      className="border-b border-border-subtle/50 hover:bg-bg-surface transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-text-secondary font-mono whitespace-nowrap">
                        {formatDate(booking.timestamp)}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-primary font-medium">
                        {booking.fullName}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary">
                        {booking.businessName}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary">
                        <span className="inline-block bg-brand-primary/10 text-brand-primary text-xs font-medium px-2 py-0.5 rounded-full">
                          {booking.industry}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary">
                        {booking.email}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary whitespace-nowrap">
                        {booking.preferredDay}, {booking.preferredTime}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary max-w-[200px] truncate">
                        {booking.notes || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </section>
  );
}
