import google.generativeai as genai
import os
from PIL import Image

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def describe_image(image_cv2) -> str:
    """
    Recebe uma imagem (numpy array do OpenCV), converte para PIL
    e envia para o Gemini para descrição técnica.
    """
    # Converter OpenCV (BGR) para PIL (RGB)
    img_pil = Image.fromarray(image_cv2[..., ::-1]) 
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = """
    Você é um tutor de IA, especialista em extrair o conhecimento essencial de materiais didáticos visuais para ajudar estudantes.
    Sua tarefa é analisar a imagem de uma videoaula e gerar um objeto JSON que descreva o elemento visual encontrado. 
    Siga estes passos:
    1. Identificação: O frame contém um elemento visual principal (diagrama, fluxograma, gráfico, código, tabela, etc.)? 
    2. Classificação: Se sim, classifique este elemento. 
    3. Descrição: Descreva o conteúdo e o propósito do elemento visual de forma clara e concisa. Se for um fluxograma, descreva seus passos. Se for um código, explique sua função. Se for um gráfico, interprete seus dados. 
    A resposta deve ser apenas o objeto JSON, sem texto adicional. O JSON deve seguir esta estrutura: "contem_elemento" (booleano), "tipo_elemento" (string) e "descricao" (string). Se não houver elemento, o valor de "tipo_elemento" e "descricao" deve ser null.
    # Exemplo 1: Imagem com Diagrama UML
    { "contem_elemento": true, "tipo_elemento": "Diagrama de Casos de Uso", "descricao": "O diagrama mostra os atores 'Estudante' e 'Secretária' e casos de uso como 'Solicita histórico' e 'Matricular aluno'."}
    # Exemplo 2: Imagem sem elemento
    {"contem_elemento": false, "tipo_elemento": null, "descricao": null, "objetivo_pedagogico": null}
    Agora, analise a imagem fornecida.
    """
    
    try:
        response = model.generate_content([prompt, img_pil])
        return response.text
    except Exception as e:
        print(f"Erro no VLM: {e}")
        return "\{\}"