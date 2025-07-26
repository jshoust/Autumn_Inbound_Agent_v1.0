import CallRecordsTable from "@/components/call-records-table";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <CallRecordsTable />
      </div>
    </div>
  );
}