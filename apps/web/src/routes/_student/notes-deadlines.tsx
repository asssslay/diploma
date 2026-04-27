import { createFileRoute } from "@tanstack/react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DeadlinesTab } from "./notes-deadlines/deadlines-tab";
import { NotesTab } from "./notes-deadlines/notes-tab";

export const Route = createFileRoute("/_student/notes-deadlines")({
  component: NotesDeadlinesPage,
});

function NotesDeadlinesPage() {
  return (
    <div className="space-y-6 px-8 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notes & Deadlines</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep track of your personal notes and upcoming deadlines.
        </p>
      </div>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-6">
          <NotesTab />
        </TabsContent>

        <TabsContent value="deadlines" className="mt-6">
          <DeadlinesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
