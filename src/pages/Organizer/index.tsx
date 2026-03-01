import { FolderTree } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card';

export function OrganizerPage() {
  return (
    <div className="p-4">
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FolderTree className="h-5 w-5 text-primary" />
            Organizer (M2)
          </CardTitle>
          <CardDescription>Batch move / rename / alias workflow will land in the next milestone.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">UI scaffold is ready for directory tree and batch operations.</p>
        </CardContent>
      </Card>
    </div>
  );
}
