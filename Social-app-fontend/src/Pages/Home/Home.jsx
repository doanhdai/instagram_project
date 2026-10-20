import NewsFeed from "../../Pages/NewsFeed/index";
import Stories from "../../Pages/Stories/index";
import { useWebSocket } from "../../Utils/configCallVideo/websocket";

const Home = () => {
  useWebSocket();
  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <Stories />
      <NewsFeed />
    </div>
  );
};

export default Home;
