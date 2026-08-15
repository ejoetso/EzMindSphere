/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { MindMapNode } from '../types.js';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.warn('GEMINI_API_KEY not set or placeholder. Running AI module in mock fallback mode.');
    return null;
  }

  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    return aiClient;
  } catch (error) {
    console.error('Failed to initialize Gemini Client:', error);
    return null;
  }
}

/**
 * AI Suggestion for new nodes based on current map structure
 */
export async function suggestNodes(
  subject: string,
  sessionTitle: string,
  existingNodes: MindMapNode[]
): Promise<Array<{ title: string; category: string; description: string; color: string; icon: string }>> {
  const client = getGeminiClient();
  const existingTitles = existingNodes.map(n => `${n.title} (${n.category})`).join(', ');

  if (!client) {
    // Elegant fallback simulation
    return [
      {
        title: 'Syntax & Formatting',
        category: 'Best Practices',
        description: 'Common formatting guides, indentation rules, and styling conventions for clean code.',
        color: '#8b5cf6',
        icon: '📝'
      },
      {
        title: 'Error Handling',
        category: 'Debugging',
        description: 'How to manage and catch runtime exceptions securely and gracefully.',
        color: '#ef4444',
        icon: '🐛'
      },
      {
        title: 'Real-world Use Cases',
        category: 'Application',
        description: 'Practical project examples demonstrating this topic in production systems.',
        color: '#10b981',
        icon: '🚀'
      },
      {
        title: 'Performance Optimization',
        category: 'Advanced',
        description: 'Tips and strategies to speed up execution time and minimize memory footprint.',
        color: '#f59e0b',
        icon: '⚡'
      }
    ];
  }

  try {
    const prompt = `You are an educational AI assistant for EzMindSphere. The class is collaboratively building a mind map.
Subject: "${subject}"
Session Topic: "${sessionTitle}"
Currently, the mind map has these ideas: [${existingTitles}].

Suggest 4 new sub-topics, branches, or adjacent concepts that students can explore.
For each suggestion, provide:
1. title: Short name of the subtopic (max 4 words)
2. category: Educational group or branch name
3. description: Brief learning guide or question to answer (max 20 words)
4. color: A hex color code that fits nicely (e.g. #3b82f6, #10b981, #f59e0b, #ec4899, #8b5cf6)
5. icon: A single emoji representing the idea

Ensure they are educational, relevant, and expand upon the existing map rather than duplicating it.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              color: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ['title', 'category', 'description', 'color', 'icon']
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error('Empty response from Gemini');
  } catch (error) {
    console.error('Error in Gemini suggestNodes:', error);
    // Fallback if AI call fails
    return [
      {
        title: 'Core Best Practices',
        category: 'Standards',
        description: 'Establish standard conventions and workflows for master level efficiency.',
        color: '#8b5cf6',
        icon: '📚'
      }
    ];
  }
}

/**
 * AI revision summary generator
 */
export async function generateSummary(
  subject: string,
  sessionTitle: string,
  nodes: MindMapNode[]
): Promise<string> {
  const client = getGeminiClient();
  const nodesSummaryList = nodes
    .map(n => `- **${n.title}** (${n.category}): ${n.description || 'No description provided'}`)
    .join('\n');

  const prompt = `You are an expert educator. Based on the collaborative mind map built in class, generate a beautiful, comprehensive, and engaging Revision Sheet / Study Handout for students.

Subject: ${subject}
Session: ${sessionTitle}

Here is the mind map content that was built live by students and teachers:
${nodesSummaryList}

Please generate an educational study guide in Markdown. Make it professional, clear, highly encouraging, and structured with:
1. **Executive Overview**: High-level synthesis of what was learned.
2. **Core Concepts Broken Down**: Elaborate slightly on the key nodes with study bullet points.
3. **Key Takeaways & Classroom Insights**: Connect the ideas elegantly.
4. **Self-Review Checklist**: 3 prompts to test student comprehension.

Use pristine formatting. Keep it concise enough to be printed as a 1-page review handout.`;

  if (!client) {
    return `### 🏫 ${sessionTitle} - Class Handout & Revision Sheet
Generated live from your collaborative mind map on **${subject}**.

#### 1. Executive Overview
Today, our class successfully brainstormed and structured the core fundamentals of **${sessionTitle}**. Through collaborative mind mapping, we explored multiple branches, establishing connections between theory and practice.

#### 2. Core Concepts Explored
${nodes.map(n => `*   **${n.title}** [${n.category}]: ${n.description || 'Explored collaboratively in session.'}`).join('\n')}

#### 3. Student Action Plan
1.  Review each of the mapped nodes above.
2.  Use these subtopics to organize your homework exercises and notes.
3.  Prepare to apply these relationships in the upcoming workshop.

---
*Created with EzMindSphere. Print or download this guide for your study files.*`;
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });
    return response.text || 'No summary generated.';
  } catch (error) {
    console.error('Error in generateSummary:', error);
    return 'Failed to generate summary due to API error.';
  }
}

/**
 * AI classroom quiz generator
 */
export async function generateQuiz(
  subject: string,
  sessionTitle: string,
  nodes: MindMapNode[]
): Promise<Array<{ question: string; options: string[]; answerIndex: number; explanation: string }>> {
  const client = getGeminiClient();
  const topics = nodes.map(n => n.title).join(', ');

  if (!client) {
    return [
      {
        question: `In the context of ${sessionTitle}, what is typically the primary focus of the central topic?`,
        options: [
          'Representing the most detailed sub-concept',
          'Serving as the anchor from which all related branches and ideas originate',
          'Storing student attendance logs',
          'Defining database storage limits'
        ],
        answerIndex: 1,
        explanation: 'The central node anchor holds the overarching subject theme from which all classroom brainstormed elements sprout.'
      },
      {
        question: `Why is it beneficial to classify concepts (like ${nodes[1]?.title || 'subtopics'}) into categories?`,
        options: [
          'It randomizes student inputs to make it more complex',
          'It organizes and groups related sub-concepts, making memory retention and cognitive mapping easier',
          'It restricts students from sharing ideas',
          'It is just decorative with no cognitive value'
        ],
        answerIndex: 1,
        explanation: 'Classification into categories group related topics which enhances cognitive organization and clarity.'
      }
    ];
  }

  try {
    const prompt = `You are a curriculum specialist. Based on the topics covered on this classroom mind map: [${topics}] for the subject "${subject}" (Topic: "${sessionTitle}"), generate 3 high-quality multiple choice review questions to test student retention.

Return the questions as a JSON array of objects. Each object must have:
1. question: Clear multiple choice question.
2. options: Exactly 4 choices.
3. answerIndex: Index (0-3) of the correct option.
4. explanation: Simple educational rationale of why it is correct.

Make sure the questions directly reference the topics that were discussed in the mind map!`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              answerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ['question', 'options', 'answerIndex', 'explanation']
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error('Empty quiz response');
  } catch (error) {
    console.error('Error in generateQuiz:', error);
    return [
      {
        question: `Which of the following best describes the main takeaways from our ${sessionTitle} session?`,
        options: [
          'Only one idea is valid',
          'Concepts are interconnected and hierarchically structured',
          'Whiteboards cannot be digitized',
          'None of the above'
        ],
        answerIndex: 1,
        explanation: 'Mind maps excel at showing structural hierarchy and connections.'
      }
    ];
  }
}

/**
 * AI mindmap generation from uploaded PDF, PPT or other lecture slides/documents
 */
export async function importMindmapFromFile(
  subject: string,
  sessionTitle: string,
  fileName: string,
  fileMimeType: string,
  base64Data: string
): Promise<{
  nodes: Array<{
    tempId: string;
    title: string;
    category: string;
    description: string;
    color: string;
    icon: string;
    parentTempId: string | null;
  }>;
  educatorTips: Array<{
    title: string;
    tipType: 'question' | 'activity' | 'misconception' | 'resource';
    text: string;
  }>;
}> {
  const client = getGeminiClient();

  if (!client) {
    // Return high quality educational mock nodes tailored to the uploaded filename & theme
    console.log('Gemini Client is in mock mode. Returning mock extracted mindmap nodes.');
    return {
      nodes: [
        { tempId: 'root', title: sessionTitle || 'Core Concept', category: 'Central Theme', description: `Main theme extracted from ${fileName}`, color: '#3b82f6', icon: '🧠', parentTempId: null },
        { tempId: 'branch1', title: 'Foundational Theory', category: 'Core Ideas', description: 'Core assumptions and essential rules discussed in slides.', color: '#10b981', icon: '📖', parentTempId: 'root' },
        { tempId: 'branch2', title: 'Hands-on Execution', category: 'Implementation', description: 'Practical code, workflows, and tools outlined in slides.', color: '#f59e0b', icon: '🛠️', parentTempId: 'root' },
        { tempId: 'branch3', title: 'System Constraints', category: 'Analysis', description: 'Limits, trade-offs, and critical parameters of standard designs.', color: '#ec4899', icon: '⚠️', parentTempId: 'root' },
        { tempId: 'detail1', title: 'Design Patterns', category: 'Core Ideas', description: 'Standard layout blueprints that improve system robustness.', color: '#10b981', icon: '📐', parentTempId: 'branch1' },
        { tempId: 'detail2', title: 'Automated Testing', category: 'Implementation', description: 'Unit testing, CI pipelines, and deployment checklists.', color: '#f59e0b', icon: '🧪', parentTempId: 'branch2' }
      ],
      educatorTips: [
        { title: 'Interactive Socratic Probe', tipType: 'question', text: 'Ask students: "What are the core bottlenecks in our implementation branch?"' },
        { title: 'Divergent Brainstorming Activity', tipType: 'activity', text: 'Have student groups research alternative tools to the ones defined in the hands-on section.' },
        { title: 'Static Mindset Misconception', tipType: 'misconception', text: 'Explain that design patterns should be adapted to scale, not treated as rigid rules.' }
      ]
    };
  }

  try {
    const prompt = `You are an advanced pedagogical AI assistant for EzMindSphere.
We have an educator who uploaded a lecture document named "${fileName}" for the course subject "${subject}" with theme "${sessionTitle}".

Your task is to analyze this document and generate:
1. A structured, rich, and cohesive Mind Map (nodes and hierarchical edges/connections) representing the core concepts, subtopics, and details inside the document. Ensure there is 1 central root node (parentTempId: null), around 3-5 subtopic nodes branching from root, and 2-3 detailed concept nodes branching from those subtopics.
2. A list of 4-6 highly actionable "Educator Tips" to help the teacher run this lesson, engage students, and address common misconceptions.

Please return the output exactly conforming to the provided JSON schema. Ensure emojis, colors, and descriptions are rich, and the hierarchy (parentTempId) is logically correct.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              tempId: { type: Type.STRING, description: "A short unique temporary identifier for this concept node, e.g., 'root', 'node1', 'node2'" },
              title: { type: Type.STRING, description: "Short title of the concept (max 4 words)" },
              category: { type: Type.STRING, description: "Educational category/discipline" },
              description: { type: Type.STRING, description: "Brief learning guide/explanation (max 20 words)" },
              color: { type: Type.STRING, description: "Hex color code that matches nicely" },
              icon: { type: Type.STRING, description: "A single emoji representing the idea" },
              parentTempId: { type: Type.STRING, description: "The tempId of the parent node, or null if this is the central topic/root node" }
            },
            required: ['tempId', 'title', 'category', 'description', 'color', 'icon', 'parentTempId']
          }
        },
        educatorTips: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Brief header/topic of the tip" },
              tipType: { type: Type.STRING, description: "Must be 'question', 'activity', 'misconception', or 'resource'" },
              text: { type: Type.STRING, description: "The description of the teaching guide tip or question (max 40 words)" }
            },
            required: ['title', 'tipType', 'text']
          }
        }
      },
      required: ['nodes', 'educatorTips']
    };

    let contents: any[] = [];
    if (fileMimeType.startsWith('text/')) {
      const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
      contents = [`Document contents:\n\n${textContent}\n\n`, prompt];
    } else {
      contents = [
        {
          inlineData: {
            mimeType: fileMimeType,
            data: base64Data
          }
        },
        prompt
      ];
    }

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error('Empty file extraction response');
  } catch (err) {
    console.error('Error in importMindmapFromFile:', err);
    // Graceful fallback on error
    return {
      nodes: [
        { tempId: 'root', title: sessionTitle || 'Core Concept', category: 'Central Theme', description: `Extracted from ${fileName}`, color: '#3b82f6', icon: '🧠', parentTempId: null },
        { tempId: 'branch1', title: 'Foundational Theory', category: 'Core Ideas', description: 'Assumptions and principles.', color: '#10b981', icon: '📖', parentTempId: 'root' },
        { tempId: 'branch2', title: 'Implementation', category: 'Practical Application', description: 'Real-world deployment.', color: '#f59e0b', icon: '🛠️', parentTempId: 'root' }
      ],
      educatorTips: [
        { title: 'Interactive Socratic Probe', tipType: 'question', text: 'Ask students: "What is the primary bottleneck of this core concept?"' }
      ]
    };
  }
}

/**
 * AI mindmap complete auditor
 */
export async function verifyMindMap(
  subject: string,
  sessionTitle: string,
  nodes: MindMapNode[]
): Promise<{
  completenessScore: number;
  checklist: Array<{ domain: string; isCovered: boolean; feedback: string }>;
  missingConcepts: Array<{
    title: string;
    category: string;
    description: string;
    color: string;
    icon: string;
    reason: string;
  }>;
}> {
  const client = getGeminiClient();

  if (!client) {
    return {
      completenessScore: 70,
      checklist: [
        { domain: 'Core Fundamentals', isCovered: true, feedback: 'The basic core definitions are solid.' },
        { domain: 'Syllabus Core Areas', isCovered: false, feedback: 'Missing key testing & validation paradigms.' },
        { domain: 'Advanced Scenarios', isCovered: false, feedback: 'Ethical considerations and limits are unaddressed.' }
      ],
      missingConcepts: [
        {
          title: 'Testing & Validation',
          category: 'Quality Control',
          description: 'How to verify solutions and ensure high reliability.',
          color: '#ef4444',
          icon: '🧪',
          reason: 'Ensures student can audit map completeness.'
        },
        {
          title: 'Ethical Implications',
          category: 'Society',
          description: 'Understanding constraints, compliance, and user safety.',
          color: '#ec4899',
          icon: '⚖️',
          reason: 'Promotes critical thinking about deployment impacts.'
        }
      ]
    };
  }

  try {
    const prompt = `You are a curriculum auditor for EzMindSphere. The class is building a collaborative mind map.
Subject: "${subject}"
Session Topic: "${sessionTitle}"

Here are the approved concepts currently mapped on the board:
${nodes.map(n => `- ${n.title} (${n.category}): ${n.description}`).join('\n')}

Audit this mind map and identify:
1. A completeness score from 0 to 100 representing how well the current map covers the essential aspects of the topic.
2. A short checklist of 3 core syllabus domains and whether they are covered.
3. 3 crucial "missing concepts" (not currently present or adjacent to current ideas) that are critical to making this map comprehensive.

Return the result exactly conforming to the provided JSON schema. Ensure the suggestions are educational, relevant, and help students discover hidden learning paths.`;

    const verifyResponseSchema = {
      type: Type.OBJECT,
      properties: {
        completenessScore: { type: Type.INTEGER, description: "A percentage value from 0 to 100" },
        checklist: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              domain: { type: Type.STRING, description: "Name of the sub-domain, e.g. Basics, Tools, Security" },
              isCovered: { type: Type.BOOLEAN, description: "True if covered in current nodes, false otherwise" },
              feedback: { type: Type.STRING, description: "Brief advice or observation" }
            },
            required: ['domain', 'isCovered', 'feedback']
          }
        },
        missingConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Title of the missing concept (max 4 words)" },
              category: { type: Type.STRING, description: "Academic category" },
              description: { type: Type.STRING, description: "Helpful study hint / explanation (max 20 words)" },
              color: { type: Type.STRING, description: "Color code" },
              icon: { type: Type.STRING, description: "A single emoji" },
              reason: { type: Type.STRING, description: "Why this concept is essential for completeness" }
            },
            required: ['title', 'category', 'description', 'color', 'icon', 'reason']
          }
        }
      },
      required: ['completenessScore', 'checklist', 'missingConcepts']
    };

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: verifyResponseSchema
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error('Empty verification response');
  } catch (err) {
    console.error('Error in verifyMindMap:', err);
    return {
      completenessScore: 65,
      checklist: [
        { domain: 'Core Fundamentals', isCovered: true, feedback: 'The basic core definitions are solid.' }
      ],
      missingConcepts: [
        {
          title: 'Testing & Validation',
          category: 'Quality Control',
          description: 'How to verify solutions and ensure high reliability.',
          color: '#ef4444',
          icon: '🧪',
          reason: 'Every map needs rigorous validation methods.'
        }
      ]
    };
  }
}

/**
 * AI Response Analysis for Open-Ended Questions: Group semantically similar responses into clusters
 */
export async function clusterOpenEndedResponses(
  questionTitle: string,
  responses: string[]
): Promise<Array<{
  label: string;
  summary: string;
  keyIdeas: string[];
  agreements: string[];
  disagreements: string[];
  misconceptions: string[];
  followUpQuestions: string[];
  matchedResponseIndices: number[];
}>> {
  if (!responses || responses.length === 0) return [];

  const client = getGeminiClient();
  if (!client) {
    const count = responses.length;
    const mid = Math.ceil(count / 2);
    return [
      {
        label: 'Primary Perspectives & Core Definitions',
        summary: `Main group of ${mid} responses focusing on fundamental ideas and direct observations.`,
        keyIdeas: ['Direct answer to core question', 'Key concept definitions'],
        agreements: ['Widespread agreement on fundamental principles'],
        disagreements: ['Minor variance in wording'],
        misconceptions: ['None detected'],
        followUpQuestions: ['How can we apply these core principles to practical cases?'],
        matchedResponseIndices: Array.from({ length: mid }, (_, i) => i)
      },
      {
        label: 'Alternative Angles & Applied Examples',
        summary: `Secondary group of responses emphasizing practical applications and edge cases.`,
        keyIdeas: ['Real-world application', 'Edge cases and limitations'],
        agreements: ['Practical utility recognized'],
        disagreements: ['Varying opinion on priority'],
        misconceptions: ['Confusing edge case with standard rule'],
        followUpQuestions: ['What trade-offs exist when scaling this approach?'],
        matchedResponseIndices: Array.from({ length: count - mid }, (_, i) => i + mid)
      }
    ];
  }

  try {
    const formattedResponses = responses.map((r, i) => `[Index ${i}]: "${r}"`).join('\n');
    const prompt = `You are an AI educational analyst for EzMindSphere Live Interaction.
Question Asked: "${questionTitle}"
Student Submissions:
${formattedResponses}

Analyze all the student submissions above and cluster them into 2 to 5 distinct semantic themes or clusters.
For each cluster:
1. label: Concise theme title (3-5 words)
2. summary: A short 1-2 sentence summary of this group
3. keyIdeas: 2-3 main takeaways
4. agreements: Points of consensus
5. disagreements: Points of debate or differing perspectives
6. misconceptions: Common misunderstandings detected
7. followUpQuestions: 1-2 probing follow-up questions for classroom discussion
8. matchedResponseIndices: Array of integer indices from the list above that belong to this cluster (e.g. [0, 2, 5])

Return JSON matching the schema.`;

    const clusterSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          summary: { type: Type.STRING },
          keyIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
          agreements: { type: Type.ARRAY, items: { type: Type.STRING } },
          disagreements: { type: Type.ARRAY, items: { type: Type.STRING } },
          misconceptions: { type: Type.ARRAY, items: { type: Type.STRING } },
          followUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchedResponseIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } }
        },
        required: ['label', 'summary', 'keyIdeas', 'matchedResponseIndices']
      }
    };

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: clusterSchema
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error('Empty clustering response');
  } catch (err) {
    console.error('Error in clusterOpenEndedResponses:', err);
    return [
      {
        label: 'Student Perspectives',
        summary: 'Combined student submissions for this activity.',
        keyIdeas: ['General consensus on the topic'],
        agreements: ['Broad alignment'],
        disagreements: [],
        misconceptions: [],
        followUpQuestions: ['What are the next steps?'],
        matchedResponseIndices: responses.map((_, i) => i)
      }
    ];
  }
}

/**
 * AI Answer Draft & Discussion Prompts for Live Q&A Questions
 */
export async function generateAIDraftAnswer(
  questionText: string,
  sessionTitle: string
): Promise<{ answer: string; discussionPrompts: string[]; relatedConcepts: string[] }> {
  const client = getGeminiClient();
  if (!client) {
    return {
      answer: `Great question regarding "${questionText}". In the context of ${sessionTitle}, this relates to core foundational principles and system design.`,
      discussionPrompts: [
        'How does this compare to alternative approaches?',
        'What real-world constraints influence this outcome?'
      ],
      relatedConcepts: ['Core Principles', 'System Design']
    };
  }

  try {
    const prompt = `You are EzMindSphere AI assisting an educator running a live interactive session.
Session Title: "${sessionTitle}"
Student Submitted Question: "${questionText}"

Provide:
1. answer: A clear, concise, accurate explanation suitable for a teacher to share with the class (max 3-4 sentences).
2. discussionPrompts: 2 engaging follow-up questions to stimulate class discussion.
3. relatedConcepts: 2-3 key terms/tags related to this question.

Return raw JSON.`;

    const answerSchema = {
      type: Type.OBJECT,
      properties: {
        answer: { type: Type.STRING },
        discussionPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
        relatedConcepts: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ['answer', 'discussionPrompts', 'relatedConcepts']
    };

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: answerSchema
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error('Empty AI answer draft response');
  } catch (err) {
    console.error('Error in generateAIDraftAnswer:', err);
    return {
      answer: `In response to "${questionText}": this topic addresses fundamental concepts in ${sessionTitle}.`,
      discussionPrompts: ['What additional examples can we brainstorm?'],
      relatedConcepts: ['Key Concept']
    };
  }
}
