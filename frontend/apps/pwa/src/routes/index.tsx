import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="font-display-lg text-5xl text-on-surface uppercase tracking-tighter">STACKBLUFF</h1>
        <p className="font-data-mono text-sm text-on-surface-variant mt-3 tracking-widest">HIGH STAKES POKER</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Play Now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-on-surface-variant text-sm mb-4">Join a table and test your skills against other players.</p>
            <Link to="/login"><Button variant="default" className="w-full">JOIN TABLE</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-on-surface-variant text-sm mb-4">See who's on top. Rankings update in real-time.</p>
            <Button variant="outline" className="w-full">VIEW RANKS</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Learn</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-on-surface-variant text-sm mb-4">New to poker? Start with the basics.</p>
            <Button variant="outline" className="w-full">GUIDE</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
