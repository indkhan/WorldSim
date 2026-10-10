import SimulationLab from "@/components/SimulationLab";
import { emptySimulation } from "@/lib/simulation/engine";
export default function Legacy() {
  return <SimulationLab initial={emptySimulation()} />;
}
