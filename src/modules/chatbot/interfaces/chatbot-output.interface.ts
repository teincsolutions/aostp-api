export interface TextResponse {
  type: 'text';
  text: string;
}

export interface MenuResponse {
  type: 'menu';
}

export type ChatbotResponse = TextResponse | MenuResponse;
