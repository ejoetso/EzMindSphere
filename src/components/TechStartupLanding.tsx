import React from 'react';
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Clock3, GitBranch, GraduationCap, Layers3, PlayCircle, QrCode, ShieldCheck, Sparkles, Users } from 'lucide-react';

const features = [
  { icon: BrainCircuit, title: 'Visual knowledge', copy: 'Turn classroom ideas into clear, collaborative mind maps in real time.' },
  { icon: Users, title: 'Live participation', copy: 'Bring every learner into polls, Q&A, brainstorming and guided activities.' },
  { icon: BarChart3, title: 'Poll Maker', copy: 'Create multiple-choice polls, collect responses live and reveal instant class results.' },
  { icon: QrCode, title: 'Join in seconds', copy: 'Students scan a dynamic QR code and participate from any modern phone.' },
  { icon: ShieldCheck, title: 'Institution ready', copy: 'Role-based access, local data persistence and activation-key licensing.' },
  { icon: Sparkles, title: 'AI learning support', copy: 'Generate summaries, quizzes and structured insights from classroom work.' },
  { icon: Layers3, title: 'One teaching canvas', copy: 'Move smoothly between 2D maps, 3D views, memos and live sessions.' },
];

const demos = [
  { title: 'Implementation overview', role: 'Platform setup, administration and key workflows', video: '/demos/implementation.mp4', screenshot: '/demos/implementation-screenshot.png' },
  { title: 'Educator walkthrough', role: 'Dashboard, Poll Maker, teaching tools and live classroom delivery', video: '/demos/educator.mp4', screenshot: '/demos/educator-screenshot.png' },
  { title: 'Student walkthrough', role: 'Joining, participating in polls and learning on mobile or desktop', video: '/demos/student.mp4', screenshot: '/demos/student-screenshot.png' },
];

export function TechStartupLanding() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#07111f] text-white selection:bg-cyan-300 selection:text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[650px] bg-[radial-gradient(circle_at_70%_15%,rgba(34,211,238,.18),transparent_38%),radial-gradient(circle_at_18%_20%,rgba(99,102,241,.22),transparent_34%)]" />
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="/techstartup" className="flex items-center gap-3 text-xl font-black tracking-tight"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-500 text-slate-950"><BrainCircuit size={22} /></span>EzMindSphere</a>
        <div className="flex items-center gap-3"><a href="#product" className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:block">Product</a><a href="#demo" className="hidden text-sm font-semibold text-slate-300 hover:text-white md:block">Demos</a><a href="#license" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold">Free licence</a></div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pb-28 lg:pt-20">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-cyan-200"><Sparkles size={14} /> The visual learning platform</div>
          <h1 className="max-w-3xl text-5xl font-black leading-[.96] tracking-[-.055em] sm:text-6xl lg:text-7xl">Make every classroom idea <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-400 bg-clip-text text-transparent">visible.</span></h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">EzMindSphere helps educators build knowledge together, understand participation live and turn each session into a lasting learning resource.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><a href="/" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-6 py-3.5 font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:-translate-y-0.5">Open the platform <ArrowRight size={19} /></a><a href="#demo" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 font-bold"><PlayCircle size={19} /> See the experience</a></div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400"><span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Free for eligible education</span><span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Mobile friendly</span></div>
        </div>

        <div className="relative" aria-label="EzMindSphere product preview">
          <div className="absolute -inset-8 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white/15 bg-white/[.07] p-3 shadow-2xl backdrop-blur-xl"><div className="rounded-[1.4rem] border border-white/10 bg-[#0c192b] p-5 sm:p-7">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Live classroom</p><h2 className="mt-1 text-xl font-extrabold">Energy & Ecosystems</h2></div><span className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Active</span></div>
            <div className="mt-6 grid grid-cols-2 gap-3">{[[Users, '28', 'Students'], [Clock3, '42m', 'Session'], [GitBranch, '19', 'Ideas'], [GraduationCap, '4', 'Activities']].map(([Icon, value, label]: any) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><Icon size={18} className="text-cyan-300" /><p className="mt-3 text-2xl font-black">{value}</p><p className="text-xs text-slate-400">{label}</p></div>)}</div>
            <div className="mt-4 rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-4"><div className="flex items-center justify-between text-xs font-bold"><span>Participation</span><span className="text-indigo-300">86%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-[86%] rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400" /></div></div>
          </div></div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[.025]"><div className="mx-auto grid max-w-7xl grid-cols-2 px-5 py-8 sm:grid-cols-4 sm:px-8">{[['3', 'Learning roles'], ['50', 'Launch licences'], ['2D + 3D', 'Visual modes'], ['Live', 'Classroom insights']].map(([value, label]) => <div key={label} className="p-4 text-center"><p className="text-2xl font-black text-cyan-300 sm:text-3xl">{value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p></div>)}</div></section>

      <section id="product" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"><div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-[.2em] text-cyan-300">Built for learning</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">From participation to understanding.</h2></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[.04] p-6 transition hover:-translate-y-1 hover:border-cyan-300/30"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300"><Icon size={22} /></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 leading-7 text-slate-400">{copy}</p></article>)}</div></section>

      <section id="demo" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-[.2em] text-cyan-300">See it in action</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Screenshots and complete demo videos.</h2><p className="mt-4 leading-7 text-slate-400">Select any preview to play the full walkthrough with video controls and full-screen viewing.</p></div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {demos.map((demo) => <article key={demo.title} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.04] shadow-xl shadow-black/20"><div className="aspect-video bg-slate-950"><video className="h-full w-full object-cover" controls preload="metadata" poster={demo.screenshot} playsInline aria-label={`${demo.title} video`}><source src={demo.video} type="video/mp4" />Your browser does not support embedded video.</video></div><div className="p-5"><h3 className="font-extrabold">{demo.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{demo.role}</p><div className="mt-4 flex flex-wrap gap-4"><a href={demo.video} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300 hover:text-cyan-200"><PlayCircle size={16} /> Open video</a><a href={demo.screenshot} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-300 hover:text-white">Open screenshot</a></div></div></article>)}
        </div>
      </section>

      <section id="license" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:pb-28"><div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-300 to-indigo-500 p-[1px]"><div className="rounded-[calc(2rem-1px)] bg-[#0b1627] px-6 py-12 text-center sm:px-12 sm:py-16"><p className="text-sm font-black uppercase tracking-[.2em] text-cyan-300">Educational institution programme</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Request your free institution licence.</h2><p className="mx-auto mt-4 max-w-2xl text-slate-300">Eligible schools, colleges, universities, training centres and non-profit educational institutions can request an EzMindSphere activation key at no licence cost.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><a href="mailto:eozoe2025@gmail.com?subject=Free%20EzMindSphere%20Institution%20Licence&body=Institution%20name%3A%0AInstitution%20type%3A%0ACountry%3A%0AContact%20name%3A%0AIntended%20educational%20use%3A" className="rounded-2xl bg-white px-6 py-3.5 font-black text-slate-950">Request free institution licence</a><a href="/" className="rounded-2xl border border-white/20 px-6 py-3.5 font-bold">Launch EzMindSphere</a></div><p className="mt-5 text-sm text-slate-500">Requests are sent to eozoe2025@gmail.com</p></div></div></section>
      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-500">Copyright © 2026 Ejoe Tso · EzMindSphere · Free for eligible educational institutions</footer>
    </main>
  );
}
