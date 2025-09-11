// Multi-AI fallback service for Campus Assistant
import type { CloudflareBindings, ChatResponse, SearchResult } from '../types';

export class AIService {
  private env: CloudflareBindings;

  constructor(env: CloudflareBindings) {
    this.env = env;
  }

  // Get context from Google Custom Search (restricted to IFHE domain)
  async getIFHEContext(query: string): Promise<SearchResult[]> {
    if (!this.env.GOOGLE_CSE_ID || !this.env.GOOGLE_CSE_API_KEY) {
      return [];
    }

    try {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.env.GOOGLE_CSE_API_KEY}&cx=${this.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=5`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.items) {
        return data.items.map((item: any) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet
        }));
      }
      return [];
    } catch (error) {
      console.error('Google CSE Error:', error);
     console.log("Search results length:", data.items?.length || 0);
console.log("Search results raw:", JSON.stringify(data.items, null, 2));
      return [];
    }
  }

  // Try Gemini API first
  async askGemini(question: string, context: string): Promise<string | null> {
    if (!this.env.GEMINI_API_KEY) {
      console.log('Gemini API key not configured');
      return null;
    }

    try {
      console.log('Trying Gemini API...');
      const prompt = `${this.getSystemPrompt()}\n\nContext:\n${context}\n\nQuestion: ${question}`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        }),
      });

      if (!response.ok) {
        console.error('Gemini API HTTP error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.log('Gemini API response:', data);
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        const text = data.candidates[0].content.parts[0].text;
        console.log('Gemini success:', text.substring(0, 100) + '...');
        return text;
      }
      
      console.log('Gemini API: No valid response');
      return null;
    } catch (error) {
      console.error('Gemini API Error:', error);
      return null;
    }
  }

  // Fallback to Groq API
  async askGroq(question: string, context: string): Promise<string | null> {
    if (!this.env.GROQ_API_KEY) {
      console.log('Groq API key not configured');
      return null;
    }

    try {
      console.log('Trying Groq API...');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b', // More reliable than deepseek
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: `Context:\n${context}\n\nQuestion: ${question}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error('Groq API HTTP error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.log('Groq API response:', data);
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content;
        console.log('Groq success:', content.substring(0, 100) + '...');
        return content;
      }
      
      console.log('Groq API: No valid response');
      return null;
    } catch (error) {
      console.error('Groq API Error:', error);
      return null;
    }
  }

  // Final fallback to OpenRouter
  async askOpenRouter(question: string, context: string): Promise<string | null> {
    if (!this.env.OPENROUTER_API_KEY) {
      console.log('OpenRouter API key not configured');
      return null;
    }

    try {
      console.log('Trying OpenRouter API...');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.env.APP_BASE_URL || 'https://campus-assistant.pages.dev',
          'X-Title': 'Campus Assistant',
        },
        body: JSON.stringify({
          model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free', // Free model
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: `Context:\n${context}\n\nQuestion: ${question}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error('OpenRouter API HTTP error:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.log('OpenRouter API response:', data);
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content;
        console.log('OpenRouter success:', content.substring(0, 100) + '...');
        return content;
      }
      
      console.log('OpenRouter API: No valid response');
      return null;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      return null;
    }
  }

  // Main function with fallback logic
  async answer(question: string): Promise<{ response: string; model: string; sourceLinks: SearchResult[] }> {
  // Fetch search results
  const searchResults = await this.getCampusContext(question);

  // Debug logs for search results
  console.log('Search results length:', searchResults.length);
  console.log('Search results raw:', JSON.stringify(searchResults, null, 2));

  // Convert results to context for AI
  const context = searchResults.map(r => `${r.title}: ${r.snippet}`).join('\n');
  console.log('Search context for AI:', context);

  let response: string | null = null;
  let modelUsed = '';

  if (context) {
    // Draft response from context
    response = await this.askGemini(question, context) 
             || await this.askGroq(question, context)
             || await this.askOpenRouter(question, context);
    modelUsed = response ? 'ai model used' : 'fallback';
  } else {
    // No search results → fallback response
    response = this.getFallbackResponse(question);
    modelUsed = 'fallback';
  }

  return { response, model: modelUsed, sourceLinks: searchResults };
}

  // Get context from campus website (renamed from getIFHEContext)
  async getCampusContext(query: string): Promise<SearchResult[]> {
    return this.getIFHEContext(query);
  }

  // Fallback response when all AI models fail
  private getFallbackResponse(question: string): string {
    const lowerQ = question.toLowerCase();
    
    if (lowerQ.includes('admission') || lowerQ.includes('apply')) {
      return `For admission information, please visit our campus admissions office or check the official website. 
      
Common requirements typically include:
- Completed application form
- Academic transcripts
- Entrance exam scores (if applicable)
- Letters of recommendation
- Personal statement

Please contact the admissions office directly for the most current information and specific requirements.`;
    }
    
    if (lowerQ.includes('course') || lowerQ.includes('program') || lowerQ.includes('degree')) {
      return `Our campus offers various academic programs across different fields of study.

To get detailed information about specific courses and programs:
- Visit the academic affairs office
- Check the official course catalog
- Speak with academic advisors
- Attend information sessions

Each program has specific requirements, duration, and career outcomes. Contact the relevant department for detailed curriculum information.`;
    }
    
    if (lowerQ.includes('fee') || lowerQ.includes('cost') || lowerQ.includes('tuition')) {
      return `For fee structure and financial information:
- Visit the finance office on campus
- Check the official fee schedule
- Inquire about scholarships and financial aid
- Ask about payment plans and options

Fee structures may vary by program and are typically updated annually. Please verify current fees with the finance office.`;
    }
    
    if (lowerQ.includes('hostel') || lowerQ.includes('accommodation') || lowerQ.includes('housing')) {
      return `Campus accommodation information:
- Visit the hostel/housing office
- Check availability and room types
- Review accommodation policies
- Submit housing applications

Most campuses offer various accommodation options including dormitories, shared rooms, and single occupancy. Contact the housing office for current availability and booking procedures.`;
    }
    
    // General fallback
    return `Thank you for your question about "${question}". 

I'd be happy to help you find the right information! For the most accurate and up-to-date details, I recommend:

📞 **Contact Options:**
- Visit the main administration office
- Check the official campus website
- Call the main campus number
- Email the student services department

🏫 **Campus Resources:**
- Student information desk
- Academic advisors
- Department offices
- Student services center

The campus staff will be able to provide you with specific, current information to answer your question completely.`;
  }

  // Format response as HTML
  formatHTML(text: string, sourceLinks: SearchResult[]): string {
    // Convert basic markdown to HTML
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      .replace(/`(.*?)`/g, '<code>$1</code>');

    // Add useful links section
    if (sourceLinks.length > 0) {
      html += '<br><br><strong>📚 Useful Links:</strong><ul>';
      sourceLinks.forEach(link => {
        html += `<li><a href="${link.link}" target="_blank" rel="noopener noreferrer">${link.title}</a></li>`;
      });
      html += '</ul>';
    }

    // Add disclaimer
    html += '<br><br><small><em>💡 This information is generated by AI and may not be completely accurate. For official information, please verify with IFHE administration or check the official website.</em></small>';

    return html;
  }

    private getSystemPrompt(): string {
    return `You are IFHE Campus Assistant. Answer questions related to the campus, including:

- Admissions, programs, courses, and degrees
- Faculty, staff, and achievements
- Campus facilities, events, and student life
- Fees, scholarships, and placements
- Student services and administration

Guidelines:
1. Use the provided context (search results) to answer questions.
2. Only provide general advice if the context has no relevant information.
3. Stay strictly on campus-related topics.
4. If asked about unrelated topics, respond:
"I'm designed to help with questions about IFHE Hyderabad and its campus. Please ask about admissions, programs, faculty, student services, or campus facilities."`;
  }


  private getErrorMessage(): string {
    return `I apologize, but I'm currently unable to process your question due to technical issues. Please try again in a moment or contact the campus administration directly for immediate assistance.

🏫 **Campus Contact:**
- Website: Contact your campus administration
- Phone: Campus main number
- Email: Campus administration email

<small><em>Our AI assistant will be back online shortly. Thank you for your patience!</em></small>`;
  }
}
