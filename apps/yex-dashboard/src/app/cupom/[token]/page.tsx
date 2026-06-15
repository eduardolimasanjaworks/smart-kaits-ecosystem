import ResgatarCupomCliente from "./ResgatarCupomCliente";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PaginaResgateCupom({ params }: Props) {
  const { token } = await params;
  return <ResgatarCupomCliente token={token} />;
}
