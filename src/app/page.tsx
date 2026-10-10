import ShippingLab from "@/components/ShippingLab";
import { defaultShippingPlan, runShipping } from "@/lib/simulation/shipping";
export default function Home() {
  return <ShippingLab initial={runShipping(defaultShippingPlan)} />;
}
