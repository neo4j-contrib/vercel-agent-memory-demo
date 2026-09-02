"""Extract entities from a short conversation and store them in Neo4j.

Run this from a terminal:

    python entity_extraction.py

Each message is stored as short-term memory, then GLiNER reads it and pulls out
the entities it contains. Those entities are stored as long-term memory.

The first run downloads the GLiNER model, which takes a minute or two. It is
cached afterwards.
"""

import asyncio
import os

from dotenv import load_dotenv
from neo4j_agent_memory import MemoryClient, MemorySettings
from neo4j_agent_memory.extraction import GLiNEREntityExtractor

load_dotenv()

SESSION_ID = "workshop-session-002"

MESSAGES = [
    "Hi, I'm John and I'm looking for running shoes for my marathon training.",
    "I've been using Nike Air Max shoes and really liked them.",
    "My budget is around $150. I prefer lightweight shoes.",
    "I live in San Francisco and train at Golden Gate Park.",
]


def build_settings() -> MemorySettings:
    """Read connection details from the environment."""
    return MemorySettings(
        neo4j={
            "uri": os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            "username": os.getenv("NEO4J_USER", "neo4j"),
            "password": os.getenv("NEO4J_PASSWORD", "password123"),
            "database": os.getenv("NEO4J_DATABASE", "neo4j"),
        }
    )


async def main() -> None:
    async with MemoryClient(build_settings()) as client:
        print("Loading GLiNER (first run downloads the model)...")

        # POLE+O gives us Person, Object, Location, Event and Organization.
        extractor = GLiNEREntityExtractor.for_poleo(use_descriptions=False)
        print("Extractor ready\n")

        stored = 0

        for text in MESSAGES:
            # 1. Store the message itself as short-term memory.
            await client.short_term.add_message(
                session_id=SESSION_ID,
                role="user",
                content=text,
            )

            print(f"[user] {text}")

            # 2. Find the entities in it.
            result = await extractor.extract(text)

            if not result.entities:
                print("       no entities found\n")
                continue

            # 3. Store each entity as long-term memory.
            for entity in result.entities:
                print(
                    f"       {entity.name:<20} {entity.type:<16}"
                    f" confidence {entity.confidence:.2f}"
                )
                await client.long_term.add_entity(
                    name=entity.name,
                    entity_type=entity.type,
                    attributes={"confidence": entity.confidence},
                )
                stored += 1

            print()

        print("-" * 60)
        print(f"Stored {len(MESSAGES)} messages and {stored} entities.")
        print("Go back to the notebook to see them in the graph.")


if __name__ == "__main__":
    asyncio.run(main())
