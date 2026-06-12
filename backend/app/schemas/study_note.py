from pydantic import BaseModel, Field


class StudyNoteRequest(BaseModel):
    prep_plan_id: int
    day: int = Field(ge=1)
    title: str
    topics: list[str]
    instructions: str = ""


class NoteSection(BaseModel):
    title: str
    body: str
    bullets: list[str] = Field(default_factory=list)


class StudyResource(BaseModel):
    title: str
    url: str
    why: str


class WebResearchSource(BaseModel):
    title: str
    url: str
    summary: str
    query: str


class StudyNoteResponse(BaseModel):
    title: str
    subtitle: str
    role: str
    topics: list[str]
    summary: str
    sections: list[NoteSection]
    deep_dive: list[NoteSection]
    interview_questions: list[str]
    related_topics: list[str]
    web_research: list[WebResearchSource] = Field(default_factory=list)
    resources: list[StudyResource]
    checklist: list[str]
    source: str = "heuristic"


class StudyNoteAskTurn(BaseModel):
    question: str
    answer: str


class StudyNoteAskRequest(BaseModel):
    note_title: str
    role: str = ""
    topics: list[str] = Field(default_factory=list)
    summary: str = ""
    sections: list[NoteSection] = Field(default_factory=list)
    question: str
    history: list[StudyNoteAskTurn] = Field(default_factory=list)


class StudyNoteAskResponse(BaseModel):
    answer: str
    interview_use: str
    next_steps: list[str] = Field(default_factory=list)
    source: str = "openai"


class StudyNoteImproveRequest(BaseModel):
    title: str
    body: str
    role: str = ""
    folder: str = ""


class StudyNoteImproveResponse(BaseModel):
    title: str
    body: str
    color: str = "#2563eb"
    source: str = "openai"
