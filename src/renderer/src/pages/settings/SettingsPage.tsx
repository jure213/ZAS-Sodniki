import { AlertTriangle, ListChecks, ScrollText, SlidersHorizontal, Tags } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditTab } from './AuditTab';
import { DangerTab } from './DangerTab';
import { DisciplinesTab } from './DisciplinesTab';
import { GeneralTab } from './GeneralTab';
import { RolesTab } from './RolesTab';

/** Admin only (route is wrapped in AdminOnly; the database enforces it too). */
export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Nastavitve" description="Obračun, vloge, discipline, dnevnik in vzdrževanje" />
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <SlidersHorizontal /> Splošno
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Tags /> Vloge in tarife
          </TabsTrigger>
          <TabsTrigger value="disciplines">
            <ListChecks /> Discipline
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ScrollText /> Dnevnik
          </TabsTrigger>
          <TabsTrigger value="danger" className="data-[state=active]:text-destructive">
            <AlertTriangle /> Nevarno območje
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="disciplines">
          <DisciplinesTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
        <TabsContent value="danger">
          <DangerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
