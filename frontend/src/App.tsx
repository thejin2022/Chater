import { BrowserRouter, Routes, Route,Navigate} from "react-router-dom";
import Chat from "./pages/Chat";
import UserAuth from "./pages/UserAuth";
import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<UserAuth />} />

        {/* 支援 /chats 與 /chats/:uri */}
        <Route
          path="/chats/:uri?"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
