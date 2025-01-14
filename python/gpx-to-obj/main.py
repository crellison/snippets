import typer
from typing_extensions import Annotated
from os import path
import glob

from gpx_to_obj import GPXtoOBJ, GPXConfig, parse_gpx_config


def main(
    gpx_file_path: str,
    out_dir: str = ".",
    config: Annotated[
        GPXConfig,
        typer.Option(
            help="Configuration parameters for GPX to OBJ conversion (as JSON)",
            parser=parse_gpx_config,
        ),
    ] = None,
) -> None:
    """
    Convert a GPX track file to a 3D OBJ mesh file.

    Args:
        gpx_file_path: Path to input GPX file or directory containing GPX files
        out_dir: Directory to write output files
        config: Optional configuration parameters
    """
    converter = GPXtoOBJ(config)

    for gpx_file in glob.glob(path.join(gpx_file_path, "*.gpx")):
        converter.run(
            gpx_file,
            path.join(out_dir, path.basename(gpx_file).replace(".gpx", ".obj")),
        )


if __name__ == "__main__":
    typer.run(main)
