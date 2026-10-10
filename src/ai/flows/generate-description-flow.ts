'use server';
/**
 * @fileOverview A flow for generating product descriptions using AI.
 *
 * - generateDescription - A function that calls the AI model to generate a description.
 * - GenerateDescriptionInput - The input type for the generation.
 * - GenerateDescriptionOutput - The output type for the generation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateDescriptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  category: z.string().describe('The category the product belongs to.'),
});
export type GenerateDescriptionInput = z.infer<typeof GenerateDescriptionInputSchema>;

const GenerateDescriptionOutputSchema = z.object({
  description: z.string().describe('The generated product description.'),
});
export type GenerateDescriptionOutput = z.infer<typeof GenerateDescriptionOutputSchema>;

export async function generateDescription(
  input: GenerateDescriptionInput
): Promise<GenerateDescriptionOutput> {
  return generateDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDescriptionPrompt',
  input: { schema: GenerateDescriptionInputSchema },
  output: { schema: GenerateDescriptionOutputSchema },
  prompt: `You are a professional copywriter specializing in e-commerce product descriptions.
  
Your task is to generate a compelling, brief (2-3 sentences) product description for the following product.

Product Name: {{{productName}}}
Category: {{{category}}}

The description should be engaging and highlight the key selling points appropriate for the category. Do not use markdown or special formatting.`,
});

const generateDescriptionFlow = ai.defineFlow(
  {
    name: 'generateDescriptionFlow',
    inputSchema: GenerateDescriptionInputSchema,
    outputSchema: GenerateDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
