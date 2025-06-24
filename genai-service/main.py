from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from ChatWebUI import ChatWebUI
import requests
from dotenv import load_dotenv
import os
import logging
from typing import Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("genai-service")

# Load environment variables
load_dotenv()

# Define FastAPI app with metadata
app = FastAPI(
    title="GenAI Service",
    description="API for GenAI applications",
    version="1.0.0"
)

class QuestionRequest(BaseModel):
    question: str

# Initialize LLM client
try:
    llm = ChatWebUI(
        api_url=os.getenv("API_URL"),
        api_key=os.getenv("API_KEY"),
        model=os.getenv("MODEL")
    )
except Exception as e:
    logger.error(f"Failed to initialize LLM client: {str(e)}")
    raise

@app.get("/health", status_code=status.HTTP_200_OK)
@app.head("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Health check endpoint for container monitoring"""
    return {"status": "healthy", "service": "genai-service"}

def build_rag_context(question: str) -> str:
    response_courses = requests.get("http://course-service:8080/courses")
    courses = response_courses.json()

    response_reviews = requests.get("http://review-service:8080/reviews")
    reviews = response_reviews.json()

    documents = []
    for course in courses:
        course_reviews = [r for r in reviews if r["courseId"] == course["id"]]
        review_texts = " ".join([r["reviewText"] for r in course_reviews])
        text = f"{course['title']} {course['description']} Credits: {course['credits']} Reviews: {review_texts}"
        documents.append(Document(page_content=text, metadata={"id": course["id"]}))

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(documents)

    embedding = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.from_documents(chunks, embedding)

    relevant_docs = db.similarity_search(question, k=4)
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    return context

@app.post("/question")
def answer_question(req: QuestionRequest):
    context = build_rag_context(req.question)

    prompt = f"""Du bist ein KI-System, das bei Kursauswahl hilft.

Nutze diesen Kontext:

{context}

Frage:
{req.question}

Antwort:"""

    answer = llm.run(prompt)
    return {"answer": answer}