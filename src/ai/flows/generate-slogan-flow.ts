
'use server';
/**
 * @fileOverview A flow for generating a business slogan using AI.
 *
 * - generateSlogan - A function that calls the AI model to generate a slogan.
 * - GenerateSloganInput - The input type for the generation.
 * - GenerateSloganOutput - The output type for the generation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateSloganInputSchema = z.object({
  businessName: z.string().describe('The name of the business.'),
  category: z.string().describe('The business category.'),
});
export type GenerateSloganInput = z.infer<typeof GenerateSloganInputSchema>;

const GenerateSloganOutputSchema = z.object({
  slogan: z.string().describe('The generated business slogan.'),
});
export type GenerateSloganOutput = z.infer<typeof GenerateSloganOutputSchema>;

export async function generateSlogan(
  input: GenerateSloganInput
): Promise<GenerateSloganOutput> {
  return generateSloganFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSloganPrompt',
  input: { schema: GenerateSloganInputSchema },
  output: { schema: GenerateSloganOutputSchema },
  prompt: `You are a branding expert who excels at writing short, catchy slogans for businesses.
  
Generate a memorable slogan (5-8 words) for the following business. The slogan should be professional and relevant to its category.

Business Name: {{{businessName}}}
Category: {{{category}}}

Do not include quotation marks in your response.`,
});

const generateSloganFlow = ai.defineFlow(
  {
    name: 'generateSloganFlow',
    inputSchema: GenerateSloganInputSchema,
    outputSchema: GenerateSloganOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
