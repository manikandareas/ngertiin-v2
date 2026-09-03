# Ngerti.in User Flow Specification

## 1. Document Purpose

This document defines the primary user flows for Ngerti.in v1.

The flows are aligned with the Product Requirement Document and Database ERD Specification.

---

# 2. Authentication Flow

```mermaid
flowchart TD
    A[Open Application] --> B{Authenticated}
    B -->|No| C[Clerk Authentication]
    C --> D[Authenticated Session]
    D --> E[Application Dashboard]
    B -->|Yes| E
```

### Expected Behavior

- Clerk is the authentication provider.
- The application maintains a local `users` record associated with `clerk_user_id`.
- Application data is loaded only after authentication is established.

---

# 3. Dashboard Flow

```mermaid
flowchart TD
    A[Dashboard] --> B{Active Module Exists}
    B -->|Yes| C[Show Continue Learning]
    B -->|No| D[Show Create Module Primary Action]

    A --> E[Modules List]
    E --> F{Module Status}

    F -->|ready| G[Open Module]
    F -->|generating| H[Open Generation Status]
    F -->|failed| I[Show Retry or Regenerate]
```

### Dashboard Priorities

1. Continue current learning.
2. View existing modules.
3. Create a new module.

The dashboard is not a social feed or public content discovery surface in v1.

---

# 4. Create Module Flow

```mermaid
flowchart TD
    A[Create Module] --> B[Add Learning Source]
    B --> C{Add More Sources}
    C -->|Yes| B
    C -->|No| D[Add Optional Instruction]
    D --> E[Review Generation Context]
    E --> F[Submit Generation Request]
    F --> G[Generation Started]
```

Supported source types:

```text
PDF
URL
Text
```

Example:

```text
PDF:
Biology Grade 11.pdf

URL:
https://example.com/digestion

Instruction:
Focus on pages 45-62 of the PDF. Use the URL only as supporting material.
```

---

# 5. Source Upload Flow

## 5.1 PDF

```mermaid
flowchart TD
    A[Select PDF] --> B[Upload File]
    B --> C[Create Source]
    C --> D[Store File]
    D --> E[Extract PDF Content]
    E --> F[Store Source Contents by Page]
    F --> G[Source Ready]
```

The file itself is stored in S3-compatible object storage.

The database stores source metadata and extracted content.

---

## 5.2 URL

```mermaid
flowchart TD
    A[Enter URL] --> B[Create Source]
    B --> C[Fetch URL]
    C --> D[Extract Main Content]
    D --> E[Normalize Content]
    E --> F[Store Source Contents]
    F --> G[Source Ready]
```

---

## 5.3 Text

```mermaid
flowchart TD
    A[Paste Text] --> B[Create Source]
    B --> C[Store Text Content]
    C --> D[Normalize Content]
    D --> E[Source Ready]
```

---

# 6. Generation Request Flow

```mermaid
flowchart TD
    A[Generation Request Submitted] --> B[Create Generation Request]
    B --> C[Attach Sources]
    C --> D[Create Module]
    D --> E[Create Generation Run]
    E --> F[Queue BullMQ Job]
    F --> G[Return Accepted Response]
```

The HTTP request must not wait for full module generation.

---

# 7. Module Generation Status Flow

```mermaid
flowchart TD
    A[Generation Started] --> B[Reading Sources]
    B --> C[Understanding Material]
    C --> D[Creating Concepts]
    D --> E[Creating Curriculum]
    E --> F[Generating Activities]
    F --> G[Validating Module]
    G --> H{Valid}
    H -->|Yes| I[Module Ready]
    H -->|No| J[Retry or Fail]
```

The frontend receives generation state through SSE or status polling.

---

# 8. Start Learning Flow

```mermaid
flowchart TD
    A[Open Ready Module] --> B[Show Learning Journey]
    B --> C[Determine Current Available Node]
    C --> D[Open Node]
    D --> E[Complete Activity]
    E --> F[Update Node Progress]
    F --> G{Assessment Activity}
    G -->|No| H[Unlock Next Core Node]
    G -->|Yes| I[Evaluate Attempt]
```

---

# 9. Lesson Flow

```mermaid
flowchart TD
    A[Open Lesson] --> B[Read Lesson Content]
    B --> C[Complete Lesson]
    C --> D[Mark Node Completed]
    D --> E[Award XP]
    E --> F[Unlock Next Node]
```

---

# 10. Flashcard Flow

```mermaid
flowchart TD
    A[Open Flashcard Node] --> B[View Card Front]
    B --> C[Reveal Answer]
    C --> D[Continue Through Cards]
    D --> E[Complete Flashcard Activity]
    E --> F[Mark Node Completed]
    F --> G[Award XP]
```

Flashcards in v1 do not require a full spaced repetition scheduler.

---

# 11. Quiz Flow

```mermaid
flowchart TD
    A[Open Quiz] --> B[Answer Questions]
    B --> C[Submit Attempt]
    C --> D[Evaluate Responses]
    D --> E[Calculate Score]
    E --> F[Calculate Concept Results]
    F --> G[Update Concept Mastery]
    G --> H[Generate Feedback]
    H --> I[Evaluate Adaptive Policy]
```

---

# 12. Adaptive Decision Flow

```mermaid
flowchart TD
    A[Updated Concept Mastery] --> B{Mastery Level}

    B -->|>= 0.75| C[Continue Core Journey]

    B -->|0.50 - 0.74| D[Optional Review]
    D --> E{User Accepts Review}
    E -->|No| C
    E -->|Yes| F[Create Adaptive Intervention]

    B -->|< 0.50| F

    F --> G[Queue Adaptive Generation]
    G --> H[Generate Adaptive Nodes]
    H --> I[Adaptive Content Available]
```

---

# 13. Adaptive Learning Flow

```mermaid
flowchart TD
    A[Adaptive Intervention Available] --> B[Open Adaptive Node]
    B --> C[Complete Review or Practice]
    C --> D{More Adaptive Nodes}
    D -->|Yes| B
    D -->|No| E[Complete Adaptive Intervention]
    E --> F[Update Mastery if Assessed]
    F --> G[Resume Core Node]
```

Adaptive content is supplemental to the original core curriculum.

---

# 14. Failed Generation Flow

```mermaid
flowchart TD
    A[Generation Step Failed] --> B{Retry Available}
    B -->|Yes| C[Retry Failed Step]
    C --> D{Succeeded}
    D -->|Yes| E[Continue Generation]
    D -->|No| F[Generation Failed]
    B -->|No| F

    F --> G[Module Status Failed]
    G --> H[Show Failure State]
```

The failure state must not silently disappear.

The user should be able to retry or regenerate when supported.

---

# 15. Resume Learning Flow

```mermaid
flowchart TD
    A[User Returns] --> B[Load Active Module Progress]
    B --> C[Read Current Node]
    C --> D[Show Continue Learning]
    D --> E[Resume Journey]
```

The learner must not manually determine where they stopped.

---

# 16. Core Journey Rules

The user journey follows the ordered core nodes generated for the module.

Example:

```text
Core 1
↓
Core 2
↓
Core 3
↓
Core 4
↓
Checkpoint
```

Adaptive branches may be inserted between core nodes for individual users.

Example:

```text
Core 1
↓
Core 2
↓
Core 3
↓
Adaptive Review
↓
Adaptive Practice
↓
Core 4
```

The underlying core sequence remains unchanged.

---

# 17. Main Application Screens

```text
/sign-in
/dashboard
/modules/new
/modules/:moduleId/generation
/modules/:moduleId
/modules/:moduleId/learn/:nodeId
/profile
```

Exact route naming may change during implementation, but the responsibilities should remain equivalent.

---

# 18. Navigation Principles

- The application should always make the next learning action clear.
- Users should not need to understand concepts such as generation runs, source extraction, or mastery calculation.
- Technical generation state should be translated into concise user-facing progress states.
- Adaptive content should appear as part of the learning journey, not as a separate administrative feature.
