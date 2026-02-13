import { google } from '@ai-sdk/google';
import { generateText, Output } from "ai"
import { z } from "zod"

const frameAnalysisSchema = z.object({
  contem_elemento: z.boolean().nullable(),
  tipo_elemento: z.string().nullable(),
  descricao: z.string().nullable(),
})

export async function POST(req: Request) {
  try {
    const { imageBase64, timestamp } = await req.json()

    if (!imageBase64) {
      return Response.json(
        { error: "Imagem nao fornecida" },
        { status: 400 }
      )
    }

    const base64Data = imageBase64.startsWith("data:")
      ? imageBase64.split(",")[1]
      : imageBase64

    const result = await generateText({
      model: google("gemini-2.5-flash-lite"),
      messages: [
        {
          role: "system",
          content: ` Você é um tutor de IA, especialista em extrair o conhecimento essencial de materiais didáticos visuais para ajudar estudantes.
    Sua tarefa é analisar a imagem de uma videoaula e gerar um objeto JSON que descreva o elemento visual encontrado. 
    Siga estes passos:
    1. Identificação: O frame contém um elemento visual principal (diagrama, fluxograma, gráfico, código, tabela, etc.)? 
    2. Classificação: Se sim, classifique este elemento. 
    3. Descrição: Descreva o conteúdo e o propósito do elemento visual de forma clara e concisa. Se for um fluxograma, descreva seus passos. Se for um código, explique sua função. Se for um gráfico, interprete seus dados. 
    A resposta deve ser apenas o objeto JSON, sem texto adicional. O JSON deve seguir esta estrutura: "contem_elemento" (booleano), "tipo_elemento" (string) e "descricao" (string). Se não houver elemento, o valor de "tipo_elemento" e "descricao" deve ser null.
    # Exemplo 1: Imagem com Diagrama UML
    { "contem_elemento": true, "tipo_elemento": "Diagrama de Casos de Uso", "descricao": "O diagrama mostra os atores 'Estudante' e 'Secretária' e casos de uso como 'Solicita histórico' e 'Matricular aluno'."}
    # Exemplo 2: Imagem sem elemento
    {"contem_elemento": false, "tipo_elemento": null, "descricao": null}
    Agora, analise a imagem fornecida.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise este frame capturado no timestamp ${timestamp}s de uma aula em video. Identifique se contem algum elemento figurado visual (diagrama, tabela, grafico, fluxograma, codigo, formula, etc.) e forneca uma descricao acessivel detalhada em portugues do Brasil.`,
            },
            {
              type: "image",
              image: base64Data,
            },
          ],
        },
      ],
      output: Output.object({
        schema: frameAnalysisSchema,
      }),
    })

    return Response.json(result.output)
  } catch (error) {
    console.error("Erro ao analisar frame:", error)
    return Response.json(
      { error: "Erro ao processar a analise do frame" },
      { status: 500 }
    )
  }
}
