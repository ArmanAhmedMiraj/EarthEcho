"""EarthEcho farm advisor agent, built with Pydantic AI.

The agent plans its own steps and calls tools through the Model Context Protocol (MCP):
it starts our three MCP servers (mcp/ folder) as child processes and uses their tools
(knowledge search and crop ranges, live soil/hazards/dry spell, nearby market prices),
then writes a short, plain-language brief for one plot.

Setup (once):    pip install -r agents/requirements.txt
Run:             python agents/farm_advisor.py --lat 24.78 --lon 89.31 --country BD "What should I do this week?"
Model:           AGENT_MODEL (default groq:openai/gpt-oss-120b, needs GROQ_API_KEY in the environment).
Dry run:         AGENT_MODEL=test runs the same agent with a scripted offline model (no key) that calls three real tools,
                 to check the tool wiring.
"""
import argparse
import asyncio
import os
from pathlib import Path

from fastmcp.client.transports import StdioTransport
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPToolset

ROOT = Path(__file__).resolve().parent.parent

SYSTEM = (
    "You are EarthEcho's farm advisor for a smallholder farmer. Plan your steps and use the tools: "
    "search_knowledge and get_crop_ranges for farming knowledge, get_soil, get_hazards and get_dry_spell for the plot, "
    "get_market_prices for nearby prices. Use only numbers the tools return, never invent numbers, doses or dates, "
    "and never forecast yield or income. Say which tool each fact came from. Answer in short plain sentences, at most 150 words, "
    "and end with: This is decision support: you decide after checking with your local agriculture officer."
)


def servers():
    names = ["earthecho-mcp.js", "earthecho-live-mcp.js", "earthecho-market-mcp.js"]
    return [MCPToolset(StdioTransport(command="node", args=[str(ROOT / "mcp" / n)], cwd=str(ROOT))) for n in names]


def scripted_model(lat, lon, country):
    """Offline model for a dry run: it calls three real tools with correct arguments, then reports what came back."""
    from pydantic_ai.messages import ModelResponse, TextPart, ToolCallPart
    from pydantic_ai.models.function import FunctionModel

    def step(messages, info):
        returned = [p for m in messages for p in m.parts if p.part_kind == "tool-return"]
        if not returned:
            return ModelResponse(parts=[
                ToolCallPart("get_crop_ranges", {"crop": "lentil"}),
                ToolCallPart("get_soil", {"lat": lat, "lon": lon}),
                ToolCallPart("get_market_prices", {"lat": lat, "lon": lon, "country": country}),
            ])
        return ModelResponse(parts=[TextPart(f"Dry run: {len(returned)} tool results came back through MCP (no language model was used).")])

    return FunctionModel(step)


def build_agent(model):
    return Agent(model, instructions=SYSTEM, toolsets=servers())


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("question", nargs="*", default=["What should I do on my farm this week?"])
    p.add_argument("--lat", type=float, default=24.78)
    p.add_argument("--lon", type=float, default=89.31)
    p.add_argument("--country", default="BD")
    a = p.parse_args()
    name = os.environ.get("AGENT_MODEL", "groq:openai/gpt-oss-120b")
    model = scripted_model(a.lat, a.lon, a.country) if name == "test" else name
    agent = build_agent(model)
    prompt = f"Plot at latitude {a.lat}, longitude {a.lon}, country {a.country}. {' '.join(a.question)}"
    async with agent:
        result = await agent.run(prompt)
    calls = [part.tool_name for m in result.all_messages() for part in getattr(m, "parts", []) if part.part_kind == "tool-call"]
    print("Tools the agent called:", ", ".join(calls) or "none")
    print("\n" + str(result.output))


if __name__ == "__main__":
    asyncio.run(main())
