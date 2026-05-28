import MenuSlideshow from "@/components/MenuSlideshow";
import { getMenu } from "@/lib/menu";

export const dynamic = "force-static";

export default function Page() {
  const menu = getMenu();
  return <MenuSlideshow menu={menu} />;
}
