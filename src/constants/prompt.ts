import { Prompt } from '@type/prompt';

const defaultPrompts: Prompt[] = [
  {
    "id": "8d9d1f6c-0cb2-41a0-a871-aa8762bdc7e1",
    "name": "Analysis: Style, Tone, & Mood",
    "prompt": "Analyze the style, tone, and mood in the following text sample. Examine the author's use of language, sentence structure, and literary techniques. Identify key stylistic choices and their impact on the overall narrative:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "f5f44282-6353-4f06-9298-c9843db52cbe",
    "name": "Analysis: Emotional Sentiment",
    "prompt": "Analyze the emotional sentiment in the following text sample. Identify the range of emotions conveyed and assess the effectiveness of their portrayal. Consider the impact of emotional resonance on readers:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "5f8f3ea1-d11c-4c14-bfc8-0bdfa2539879",
    "name": "Analysis: Character Relationship",
    "prompt": "Analyze the relationship between characters in the following text sample. Evaluate the dynamics, conflicts, and connections between the characters. Consider the significance of their interactions on the overall narrative:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "91c88102-5123-4a6d-af96-64e959e662d2",
    "name": "Analysis: Character Motivation",
    "prompt": "Analyze the character motivation in the following text sample. Analyze the reasons behind their actions and decisions. Consider the underlying desires, fears, or goals that drive the characters' behaviors:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "3b0fc4a5-a8e6-45e0-bcf1-6a3e1953d667",
    "name": "Analysis: Internal Conflict",
    "prompt": "Analyze the character's internal conflict in the following text sample. Examine the conflicting emotions, thoughts, or beliefs within the character. Explore how this conflict affects their choices and development:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "e6c21876-4071-4fbc-9d45-4664c4543179",
    "name": "Analysis: Tone Coherence",
    "prompt": "Examine the tonal consistency and coherence in the provided text. Identify the tones used by the author throughout the narrative and discuss how they influence the reader's perception of the story. Evaluate any shifts in tone, considering if they add to or detract from the narrative's overall impact. Suggest improvements to establish consistent and coherent tone:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "eb637f5a-4b96-4735-bf6f-2726f9e526fc",
    "name": "Analysis: Tension Evaluation",
    "prompt": "Evaluate the manner in which tension is built, sustained and released in the given text. Discuss the techniques used by the author to create suspense and keep the reader engaged. Assess whether the tension remained consistent throughout, built to a climax, or fluctuated. Identify segments where the tension could be enhanced or managed differently for a more impactful reader experience:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "d544a9bf-8a5d-4d7f-b6ec-c12345de6789",
    "name": "Analysis: Character Complexity",
    "prompt": "Review character complexity in the following text sample. Analyze the depth and development of the characters. Assess their motivations, conflicts, and growth throughout the narrative. Identify areas for improvement or enhancement to create well-rounded and compelling characters:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "c6789de4-efab-1234-b567-54321cdef890",
    "name": "Analysis: Dialogue Realism",
    "prompt": "Examine dialogue realism in the following text sample. Assess the authenticity and believability of the character dialogues. Consider the naturalness of conversations, individual character voices, and appropriate language usage. Identify areas for refinement or adjustments to enhance dialogue realism:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "9a876543-cdef-4321-b098-ef1234567890",
    "name": "Analysis: Thematic Depth",
    "prompt": "Examine thematic depth in the following text sample. Analyze the underlying themes and their exploration throughout the narrative. Assess the depth and effectiveness of conveying meaningful ideas or messages. Identify opportunities to delve deeper into the themes or strengthen their impact:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "f84689be-0b3a-4ed1-a711-038744dc0695",
    "name": "Suggestions: Scene Transitions",
    "prompt": "Provide suggestions on how to improve the scene transitions in the following text sample. Identify opportunities to make the transitions smoother and more seamless. Enhance the transitions to maintain reader engagement and narrative continuity. List three of these scene transitions below:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "f30102ae-4b23-4116-9058-f07d5e782d1a",
    "name": "Suggestions: Conflict Escalation",
    "prompt": "Provide suggestions on how to escalate the conflict in the following text sample. Evaluate the intensity and progression of conflicts and identify opportunities to heighten the tension and raise the stakes. List three of these suggestions below:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "3d79cee5-e881-4c69-bc70-09400dc8ce2b",
    "name": "Suggestions: Metaphor & Simile",
    "prompt": "Provide suggestions on how to incorporate metaphors and similes into the following text sample. Identify opportunities for using captivating figurative language to enhance descriptions, evoke emotions, or convey complex ideas. Develop metaphors and similes that enrich the reader's experience. List five of these in bullet points:",
    "config": null,
    "includeSelection": true
  },
  {
    "id": "31f0754e-3d01-40a2-b2b7-4f6ba4b33a3d",
    "name": "Suggestions: Plot Twist",
    "prompt": "Provide plot twist ideas for the following text sample. Identify opportunities to introduce unexpected and captivating plot developments that will engage readers and introduce intriguing twists to the storyline. List three of these plot twists below:",
    "config": null,
    "includeSelection": true
  },
  {
    "id" : "f0c95711-dace-44d6-b8a1-3f38e8f242d8",
    "name" : "Suggestions: Rephrase",
    "prompt" : "Provide suggestions on how to rephrase the following text sample. Identify areas where the language can be simplified or rephrased to enhance clarity and readability. List three of these suggestions below:",
    "config" : null,
    "includeSelection" : true
  },
  {
    "id" : "7b4b6583-8757-4256-8d56-16e09f2303cd",
    "name" : "Suggestions: Extend Scene",
    "prompt" : "Provide suggestions on how to extend the following scene. Identify opportunities to continue the scene and develop the narrative further. Consider how the scene can be expanded to enhance the plot, character development, or emotional impact. List three of these suggestions below:",
    "config" : null,
    "includeSelection" : true
  },
    {
      "id": "80b88f7e-beee-4e84-b9c9-9d100c43aa61",
      "name": "Suggestions: Enrich Vocabulary",
      "prompt": "Provide suggestions on how to enrich the vocabulary in the following text sample. Identify opportunities to incorporate more varied and precise language to enhance the richness and depth of the narrative. Provide five bulleted examples:",
      "config": null,
      "includeSelection": true
    },
    {
      "id": "904e69f7-fbbd-411f-a9dd-ca9c3aebd966",
      "name": "Suggestions: Emotional Impact",
      "prompt": "Provide suggestions on how to increase the emotional impact of the following text sample. Identify areas where emotions can be intensified or more effectively conveyed to resonate with readers on a deeper level. Provide five bulleted examples:",
      "config": null,
      "includeSelection": true
    },
    {
      "id": "f0c95711-dace-44d6-b8a1-3f38e8f242d8",
      "name": "Revise: Sentence Structure",
      "prompt": "Revise the following text sample to improve the sentence structure. Identify areas where the sentences can be rephrased or rearranged to enhance clarity and readability:",
      "config": null,
      "includeSelection": true
    },
    {
      "id": "6b1fce8b-ff7f-48c6-b141-addb83a6165c",
      "name": "Revise: Trim Exposition",
      "prompt": "Revise the following text sample to trim exposition. Identify areas where the exposition can be reduced or rephrased to enhance clarity and readability:",
      "config": null,
      "includeSelection": true
    },
    {
      "id": "90a9970a-742b-4f6e-85c9-0b59552a32c2",
      "name": "Revise: Repetitive Language",
      "prompt": "Revise the following text sample to eliminate repetitive language. Identify areas where the language can be simplified or rephrased to enhance clarity and readability:",
      "config": null,
      "includeSelection": true
    },
    {
      "id": "f0c95711-dace-44d6-b8a1-3f38e8f242d8",
      "name" : "Revise: Paraphrase",
      "prompt": "Revise the following text sample to paraphrase the language. Identify areas where the language can be simplified or rephrased to enhance clarity and readability:",
      "config": null,
      "includeSelection": true
    },
    {
      "id": "7b4b6583-8757-4256-8d56-16e09f2303cd",
      "name": "Revise: Clarify Descriptions",
      "prompt": "Revise the following text sample to clarify the descriptions. Identify areas where the descriptions can be rephrased with more precise language to enhance clarity and readability:",
      "config": null,
      "includeSelection": true
    },
]




export default defaultPrompts;
