import { useMemo } from "react";
import { SendHorizonal, Bot, User } from "lucide-react";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  inputValue: string;
  onChangeInput: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
}

export default function ChatPanel({
  messages,
  inputValue,
  onChangeInput,
  onSend,
  isSending,
}: ChatPanelProps) {
  const canSend = inputValue.trim().length > 0 && !isSending;

  const groupedMessages = useMemo(() => messages.slice(-20), [messages]);

  return (
    <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-cyan-500/20 bg-slate-950/60 backdrop-blur-md text-slate-100 pt-24">
      <header className="px-5 py-4 border-b border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Ocean Copilot</h3>
        <p className="text-xs text-slate-400 mt-1">
          Converse em linguagem natural para ajustar o globo ou tirar dúvidas.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {groupedMessages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${
              message.role === "user" ? "flex-row-reverse text-right" : ""
            }`}
          >
            <div
              className={`mt-1 rounded-full p-2 ${
                message.role === "user"
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "bg-slate-800/80 text-cyan-200"
              }`}
            >
              {message.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow ${
                message.role === "user"
                  ? "bg-cyan-500/10 border border-cyan-400/20"
                  : "bg-slate-800/70 border border-slate-700/60"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <span className="mt-2 block text-[10px] uppercase tracking-wide text-slate-500">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {groupedMessages.length === 0 && (
          <p className="text-sm text-slate-400">
            Envie uma pergunta ou comando para começar a conversar com o copiloto.
          </p>
        )}
      </div>

      <form
        className="px-4 py-4 border-t border-cyan-500/20"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 focus-within:border-cyan-400/60 transition">
          <textarea
            value={inputValue}
            onChange={(event) => onChangeInput(event.target.value)}
            placeholder="Ex.: mostre apenas tubarões Sphyrna"
            rows={2}
            className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!canSend}
            className={`rounded-lg p-2 transition ${
              canSend
                ? "bg-cyan-500/80 text-slate-950 hover:bg-cyan-400"
                : "bg-slate-800/50 text-slate-600 cursor-not-allowed"
            }`}
            aria-label="Enviar mensagem"
          >
            <SendHorizonal className="w-4 h-4" />
          </button>
        </div>
        {isSending && (
          <p className="text-[11px] mt-2 text-cyan-300 uppercase tracking-wide">
            pensando...
          </p>
        )}
      </form>
    </aside>
  );
}
