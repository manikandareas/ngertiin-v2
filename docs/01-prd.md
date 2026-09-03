# Ngerti.in Product Requirement Document

## 1. Document Purpose

This document defines the product requirements for Ngerti.in v1.

Ngerti.in transforms user-provided learning materials into structured, interactive learning modules. Each module is presented as a learning journey composed of lessons, flashcards, quizzes, checkpoints, and on-demand adaptive activities.

This document defines the intended product behavior, MVP scope, user goals, and non-goals.

---

## 2. Product Summary

Ngerti.in allows users to provide one or more learning sources such as:

- PDF documents
- Web URLs
- Pasted text

Users may also provide generation instructions to narrow or shape the generated module.

Example:

```text
Source:
Biology Grade 11.pdf

Instruction:
Focus on the digestive system material on pages 45-62 and target senior high school level.
```

Ngerti.in processes the selected learning context and generates a structured module containing a sequence of learning nodes.

The module is initially generated as a stable core learning journey. Adaptive activities are generated later, on demand, when the system detects that the user requires additional reinforcement for a specific concept.

---

## 3. Product Goals

Ngerti.in v1 must:

1. Convert learning material into a structured learning journey.
2. Support multiple learning sources within one generation request.
3. Allow users to refine the generation context using instructions.
4. Generate learning modules asynchronously in the background.
5. Provide multiple learning activity types.
6. Track user progress at module and node level.
7. Evaluate user performance by concept.
8. Generate adaptive reinforcement when required.
9. Provide concise AI-assisted feedback after assessments.
10. Provide lightweight gamification through XP and streaks.

---

## 4. Non-Goals

Ngerti.in v1 does not include:

- Teacher dashboards
- Classroom management
- Live classroom monitoring
- Real-time exam monitoring
- Exam proctoring
- School administration
- Student grouping
- Assignment distribution
- Global leaderboard
- Public module marketplace
- Social feed
- User-generated course authoring
- Fully dynamic curriculum rewriting
- Autonomous AI agents
- Spaced repetition scheduling
- Multi-agent learning orchestration

These may be considered in future versions.

---

## 5. Target User

### Primary User

An individual learner who already has learning material and wants a structured way to understand it.

Typical examples:

- High school students
- University students
- Self-directed learners
- Learners preparing for exams
- Users studying from books, notes, articles, or documentation

---

## 6. Core User Problem

Learning material is often available, but the learner must still determine:

- What concepts matter
- What order to study them in
- Which parts require memorization
- Which parts require practice
- Whether they actually understand the material
- What should be reviewed after making mistakes

Ngerti.in reduces this planning effort by converting raw material into a guided learning journey.

---

## 7. Core Product Flow

```text
User
↓
Create Generation Request
↓
Add One or More Sources
↓
Add Optional Instruction
↓
Submit
↓
Background Generation
↓
Module Ready
↓
Start Learning Journey
↓
Complete Learning Nodes
↓
Submit Attempts
↓
Receive Evaluation and Feedback
↓
Update Concept Mastery
↓
Continue Core Journey
or
Generate Adaptive Reinforcement
```

---

## 8. Module Structure

A generated module contains:

- Metadata
- Concepts
- Core learning nodes
- Activities
- Progress state

Example:

```text
Digestive System

1. Introduction to Digestion
   Lesson

2. Digestive Organs
   Flashcards

3. Organ Functions
   Quiz

4. Digestion Process
   Lesson

5. Digestive Enzymes
   Flashcards

6. Enzyme Check
   Quiz

7. Final Checkpoint
   Checkpoint
```

The number of nodes is not fixed.

The module length depends on:

- Source length
- Number of concepts
- Concept complexity
- User instruction
- Generated curriculum structure

---

## 9. Core and Adaptive Learning

### 9.1 Core Nodes

Core nodes are generated during the initial module generation.

Core nodes define the stable curriculum.

Supported core node types:

```text
lesson
flashcard
quiz
checkpoint
```

### 9.2 Adaptive Nodes

Adaptive nodes are not generated during the initial module generation.

They are generated on demand when the system detects insufficient mastery.

Supported adaptive node types:

```text
review
practice
remedial_quiz
flashcard
```

Example:

```text
Core Node 3
Quiz
↓
Low mastery on digestive_enzymes
↓
Adaptive Intervention
├── Review
├── Flashcards
└── Remedial Quiz
↓
Resume Core Node 4
```

Adaptive generation must not rewrite or remove the core curriculum.

---

## 10. Source Input Requirements

A generation request may contain one or more sources.

Supported source types:

```text
pdf
url
text
```

Example combinations:

```text
PDF

PDF + Instruction

URL + Text

PDF + URL

PDF + URL + Text + Instruction
```

Each source may have a role:

```text
primary
reference
supplementary
```

A generation request may also define selectors.

Example:

```json
{
  "pages": {
    "from": 45,
    "to": 62
  }
}
```

---

## 11. Module Generation Experience

Module generation must not block the HTTP request.

The user submits a generation request and receives an immediate response indicating that generation has started.

The frontend must be able to display progress.

Example:

```text
Reading sources
Understanding material
Creating concepts
Creating learning journey
Generating activities
Validating module
```

The user may leave the page while generation continues.

---

## 12. Learning Activities

### 12.1 Lesson

Purpose:

Provide a concise explanation of a concept.

May contain:

- Explanation
- Key points
- Examples
- Important terms

### 12.2 Flashcard

Purpose:

Reinforce recall of important facts or definitions.

Each flashcard contains:

- Front
- Back

### 12.3 Quiz

Purpose:

Assess one or more concepts.

Initial supported question types:

```text
multiple_choice
true_false
short_answer
```

### 12.4 Checkpoint

Purpose:

Assess multiple concepts across a larger portion of the module.

---

## 13. Evaluation and Feedback

After an assessment activity:

1. The user response is stored.
2. The system evaluates the answer.
3. Concept-level performance is calculated.
4. User concept mastery is updated.
5. AI feedback may be generated.
6. The adaptive policy is evaluated.

Feedback must be concise and tied to the user's demonstrated performance.

Example:

```text
You understand the digestive organs well, but you are still mixing up the functions of pepsin and amylase.
```

AI feedback must not be the sole input for adaptive decisions.

Adaptive decisions must use structured performance and mastery data.

---

## 14. Concept Mastery

Each module contains a set of concepts.

Example:

```text
digestive_organs
organ_functions
digestion_process
digestive_enzymes
digestive_disorders
```

Each assessment may evaluate one or more concepts.

Ngerti.in maintains mastery per user, module, and concept.

Recommended initial scale:

```text
0.00 - 1.00
```

Baseline interpretation:

```text
>= 0.75
Mastered enough to continue

>= 0.50 and < 0.75
Review may be recommended

< 0.50
Adaptive intervention required
```

Exact thresholds remain configurable business rules.

---

## 15. Progress

Ngerti.in tracks:

- Module progress
- Node progress
- Current node
- Attempt count
- Best score
- Completion state
- Concept mastery

Module progress should represent progress through the core journey.

Adaptive nodes are supplemental and should not permanently distort the core completion percentage.

---

## 16. Gamification

Ngerti.in v1 includes lightweight gamification.

Supported features:

- XP
- Current streak
- Longest streak
- Module completion status

XP must be stored as ledger events.

Initial XP reasons:

```text
node_completed
quiz_completed
perfect_score
checkpoint_completed
adaptive_completed
```

---

## 17. Dashboard Requirements

The dashboard should prioritize continuation of learning.

Primary sections:

### Continue Learning

Displays the most relevant active module.

Example:

```text
Digestive System
72% complete
Next: Digestive Enzymes

Continue
```

### Modules

Displays the user's modules and their status.

Possible statuses:

```text
generating
ready
failed
archived
```

---

## 18. Create Module Requirements

The create flow must support:

- Upload PDF
- Add URL
- Paste learning material
- Add multiple sources
- Add optional instruction
- Submit generation request

The user must be able to distinguish:

```text
Learning Material
```

from:

```text
Generation Instruction
```

The application must not rely on the AI model to infer whether arbitrary text is source material or an instruction.

---

## 19. Success Criteria

Ngerti.in v1 is considered functionally complete when a user can:

1. Sign in.
2. Create a generation request.
3. Add one or more sources.
4. Provide an optional instruction.
5. Generate a module asynchronously.
6. Open the generated learning journey.
7. Complete lessons, flashcards, and quizzes.
8. Receive assessment feedback.
9. Have concept mastery updated.
10. Receive an adaptive intervention when required.
11. Resume the core learning journey.
12. Continue progress after returning later.

---

## 20. Product Principle

The core curriculum must remain understandable and stable.

Personalization should adapt the learner's path through the curriculum, not continuously rewrite the curriculum itself.
