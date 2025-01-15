from dataclasses import dataclass
from typing import List, Tuple
import os


@dataclass
class ObjFile:
    _vertices: List[Tuple[float, float, float]]
    _polygons: List[List[int]]

    def add_vertices(self, vertices: List[Tuple[float, float, float]]) -> None:
        self._vertices.extend(vertices)

    def add_polygons(self, polygons: List[List[int]]) -> None:
        self._polygons.extend(polygons)

    def write_to_file(self, file_path: str) -> None:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w") as file:
            for vertex in self._vertices:
                file.write(f"v {vertex[0]} {vertex[1]} {vertex[2]}\n")
            file.write("\n")
            for polygon in self._polygons:
                file.write(f"f {' '.join(map(str, polygon))}\n")
