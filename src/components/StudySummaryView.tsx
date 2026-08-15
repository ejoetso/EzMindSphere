/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Check, X, Award, HelpCircle, FileText, ArrowLeft, RefreshCw, Printer } from 'lucide-react';
import { Session, MindMapNode, MindMapEdge } from '../types.js';

interface StudySummaryViewProps {
  session: Session;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  summaryMarkdown: string;
  quizQuestions: Array<{ question: string; options: string[]; answerIndex: number; explanation: string }>;
  onBackToMap: () => void;
}

export const StudySummaryView: React.FC<StudySummaryViewProps> = ({
  session,
  nodes,
  edges,
  summaryMarkdown,
  quizQuestions,
  onBackToMap,
}) => {
  // Quiz active states
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);

  // Parse markdown simplified custom parser (guarantees perfect styled output without markdown rendering conflicts)
  const parseMarkdownToHTML = (md: string) => {
    return md.split('\n').map((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return <div key={idx} className="h-2" />;

      // Header 3
      if (cleanLine.startsWith('###')) {
        return (
          <h3 key={idx} className="text-sm font-bold font-display text-slate-800 dark:text-slate-100 mt-4 mb-2">
            {cleanLine.replace('###', '').trim()}
          </h3>
        );
      }

      // Header 4
      if (cleanLine.startsWith('####')) {
        return (
          <h4 key={idx} className="text-xs font-bold font-display text-slate-700 dark:text-slate-200 mt-3 mb-1.5 uppercase tracking-wide">
            {cleanLine.replace('####', '').trim()}
          </h4>
        );
      }

      // Bullets
      if (cleanLine.startsWith('*') || cleanLine.startsWith('-')) {
        const text = cleanLine.substring(1).trim();
        return (
          <li key={idx} className="text-xs text-slate-600 dark:text-slate-400 ml-4 list-disc mb-1 leading-relaxed">
            {text}
          </li>
        );
      }

      // Horizontal line
      if (cleanLine === '---') {
        return <hr key={idx} className="border-slate-200 dark:border-slate-800 my-4" />;
      }

      // Standard text line
      return (
        <p key={idx} className="text-xs text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
          {cleanLine}
        </p>
      );
    });
  };

  // Export JSON file helper
  const handleDownloadJSON = () => {
    const projectData = {
      app: 'EzMindSphere',
      timestamp: new Date().toISOString(),
      session,
      nodes,
      edges
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ejoe-mindsphere-${session.code.toLowerCase()}-project.json`;
    a.click();
  };

  // Export CSV of Nodes
  const handleDownloadCSV = () => {
    let csvContent = 'ID,Title,Category,CreatedBy,Votes,Description\n';
    
    nodes.forEach(node => {
      // Escape commas & quotes
      const title = `"${node.title.replace(/"/g, '""')}"`;
      const cat = `"${node.category.replace(/"/g, '""')}"`;
      const author = `"${node.createdByName.replace(/"/g, '""')}"`;
      const votes = node.votes?.length || 0;
      const desc = `"${(node.description || '').replace(/"/g, '""')}"`;

      csvContent += `${node.id},${title},${cat},${author},${votes},${desc}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindsphere-${session.code.toLowerCase()}-nodes.csv`;
    a.click();
  };

  // Quiz evaluation helper
  const handleSelectOption = (qIdx: number, oIdx: number) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const handleGradeQuiz = () => {
    let finalScore = 0;
    quizQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answerIndex) {
        finalScore++;
      }
    });
    setScore(finalScore);
    setSubmitted(true);
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setSubmitted(false);
    setScore(0);
  };

  const printHandout = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F3F5F9] dark:bg-slate-950 font-sans p-4 flex flex-col gap-4 print:bg-white print:p-0">
      
      {/* Printable page layout header */}
      <header className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 px-6 py-3 sticky top-4 z-10 print:hidden">
        <button
          onClick={onBackToMap}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Live Map
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={printHandout}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Handout
          </button>
          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg text-xs font-semibold hover:opacity-90 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow print:mt-0 print:px-0">
        
        {/* Left Side: compiled Study sheet */}
        <div className="md:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6.5 shadow-md print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-150 dark:border-slate-800 pb-4 mb-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-bold px-2 py-0.5 rounded">
                {session.subject}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                CODE: {session.code}
              </span>
            </div>

            <h1 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
              {session.title} — Revision Handout
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Collaboratively structured in class • Hosted by {session.educatorName}
            </p>
          </div>

          {/* AI generated markdown block */}
          <div className="space-y-1.5 prose prose-slate dark:prose-invert max-w-none">
            {parseMarkdownToHTML(summaryMarkdown)}
          </div>
        </div>

        {/* Right Side: Quick self-test interactive quiz */}
        <div className="md:col-span-5 space-y-6 print:hidden">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold font-display text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-500" />
                Student Self-Review Quiz
              </h3>
              
              {submitted && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                  <Award className="w-3.5 h-3.5" />
                  {score}/{quizQuestions.length} Score
                </span>
              )}
            </div>

            <div className="space-y-6">
              {quizQuestions.map((q, qIdx) => {
                const selectedOpt = selectedAnswers[qIdx];
                return (
                  <div key={qIdx} className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {qIdx + 1}. {q.question}
                    </h4>

                    <div className="space-y-1.5">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = selectedOpt === oIdx;
                        const isCorrect = q.answerIndex === oIdx;
                        const showCorrect = submitted && isCorrect;
                        const showWrong = submitted && isSelected && !isCorrect;

                        return (
                          <button
                            key={oIdx}
                            onClick={() => handleSelectOption(qIdx, oIdx)}
                            disabled={submitted}
                            className={`w-full text-left p-2.5 text-xs rounded-xl border transition-all flex items-center justify-between gap-2 ${
                              showCorrect
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-950/20 dark:text-emerald-400'
                                : showWrong
                                ? 'bg-red-50 text-red-700 border-red-400 dark:bg-red-950/20 dark:text-red-400'
                                : isSelected
                                ? 'bg-blue-50 text-blue-700 border-blue-400 dark:bg-blue-950/20 dark:text-blue-400 font-medium'
                                : 'bg-slate-50 border-slate-200 dark:bg-slate-950/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/60'
                            }`}
                          >
                            <span>{opt}</span>
                            {showCorrect && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                            {showWrong && <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanatory callout upon submittal */}
                    {submitted && selectedOpt !== undefined && (
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl text-[10px] text-slate-400 leading-normal border border-slate-100 dark:border-slate-850">
                        <strong className="text-slate-600 dark:text-slate-300 block mb-0.5">Rationale:</strong>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {!submitted ? (
                <button
                  onClick={handleGradeQuiz}
                  disabled={Object.keys(selectedAnswers).length < quizQuestions.length}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/10 transition-all text-center"
                >
                  Grade Self-Quiz
                </button>
              ) : (
                <button
                  onClick={handleResetQuiz}
                  className="w-full py-2 bg-slate-950 text-white dark:bg-white dark:text-slate-950 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 hover:opacity-90 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              )}
            </div>
          </div>

          {/* Quick Data Exports */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3.5">
            <h3 className="text-xs font-bold font-display text-slate-950 dark:text-slate-50">
              CSV Data Exports
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              Acquire spreadsheet files of classroom contributions for reporting, grade scoring, or learning analytics.
            </p>
            <button
              onClick={handleDownloadCSV}
              className="w-full py-2 text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-colors flex items-center justify-center gap-1 text-slate-600 dark:text-slate-300"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              Download Nodes CSV
            </button>
          </div>

        </div>
      </main>

    </div>
  );
};
