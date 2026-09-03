# Ngerti.in Domain Language

Ngerti.in turns learner-owned material into a stable learning journey and adds personal
reinforcement without rewriting that journey. These terms are the shared language for product,
API, worker, and persistence discussions.

## Source and Generation

**Learning Source**:
A reusable piece of learner-owned material supplied as a PDF, URL, or pasted text.
_Avoid_: Upload, document, material, input

**Generation Instruction**:
Optional guidance that narrows or shapes how selected Learning Sources become a Module; it is not
itself learning material.
_Avoid_: Prompt, source text

**Generation Request**:
An immutable selection of one or more Learning Sources, their roles and selectors, and an optional
Generation Instruction used to produce one Module.
_Avoid_: Prompt, generation job

**Source Role**:
The authority assigned to a Learning Source within one Generation Request: primary, reference, or
supplementary.
_Avoid_: Source type, priority

**Module Generation**:
The asynchronous process that turns a Generation Request into the stable content of a Module.
_Avoid_: Module creation, AI request

## Learning Content

**Module**:
A learner-owned, generated learning journey with concepts, ordered Core Nodes, activities, and
progress.
_Avoid_: Course, class

**Concept**:
A meaningful learning target defined within one Module and used to connect teaching, assessment,
and mastery evidence.
_Avoid_: Topic, tag

**Core Node**:
An ordered, stable step in a Module's original curriculum.
_Avoid_: Chapter, core activity

**Activity**:
An executable unit of learning content inside a node, such as a lesson, flashcard set, or assessment
question.
_Avoid_: Node, task

## Progress and Adaptation

**Attempt**:
An immutable submission of a learner's responses to all assessment activities in one node.
_Avoid_: Answer, response, try

**Concept Result**:
Normalized performance evidence for one Concept derived from one Attempt.
_Avoid_: Mastery, score

**Mastery**:
The current accumulated estimate of a learner's understanding of one Concept within one Module.
_Avoid_: Attempt score, grade

**Adaptive Intervention**:
A learner-specific reinforcement branch offered or required after an Attempt identifies weak
Concepts.
_Avoid_: Adaptive module, remediation module

**Adaptive Node**:
An ordered step belonging to one Adaptive Intervention; it supplements but never changes Core Node
order.
_Avoid_: Core Node, generated module

**Resume Node**:
The Core Node that becomes the learner's next destination after an Adaptive Intervention is
completed or an optional review is declined.
_Avoid_: Current node, next adaptive node

**XP Event**:
An immutable record of XP awarded for one qualifying learning action.
_Avoid_: XP total, points balance
